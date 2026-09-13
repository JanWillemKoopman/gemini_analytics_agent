/**
 * Het lezen van de kanaaldata uit Postgres, en het omzetten naar de kubus die de pagina
 * in het geheugen filtert.
 *
 * ## Waarom twee kubussen per pagina
 *
 * De grafiek heeft de tijdas nodig, de tabel heeft de advertentie nodig. Allebei tegelijk
 * — dag × advertentie × plaatsing — is gemeten 212 rijen per dag voor Meta en 315 voor
 * Google; over een kwartaal loopt dat op tot bijna 50.000 rijen en dat is te zwaar om
 * naar de browser te sturen. Daarom vat de server elk apart samen:
 *
 *   reeks   dag × account × platform × campagne      ≈ 5.500 rijen per kwartaal
 *   detail  advertentie, opgeteld over de periode    ≈ 200 – 450 rijen
 *
 * Ze delen hun filterdimensies, dus één filterselectie werkt meteen op allebei zonder
 * dat er iets opnieuw opgehaald hoeft te worden. Dat is de hele truc achter "filteren
 * kost geen netwerkverkeer".
 *
 * ## Waarom boven de 120 dagen per week
 *
 * Een jaar op dagkorrel is gemeten 891 KB gzip; per week is dat een zevende. Niemand
 * leest een jaargrafiek per dag, dus daar gaat niets verloren — behalve inzoomen binnen
 * dat jaar, en daarvoor kies je een kortere periode.
 */

import { Client } from "pg";
import type { Kubus } from "@/lib/kanalen/kubus";

/** Boven deze periodelengte vat de server samen tot weken. */
export const DAG_KORREL_MAX_DAGEN = 120;

const STATEMENT_TIMEOUT_MS = 15_000;

/** Hoeveel detailregels een pagina maximaal meekrijgt; zie `Kubus.afgekapt`. */
export const DETAIL_LIMIET = 2000;

export function isKanalenGeconfigureerd(): boolean {
  return Boolean(process.env.DATAQUERY_DATABASE_URL);
}

async function metVerbinding<T>(werk: (client: Client) => Promise<T>): Promise<T> {
  const connectionString = process.env.DATAQUERY_DATABASE_URL;
  if (!connectionString) throw new Error("DATAQUERY_DATABASE_URL ontbreekt.");

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    statement_timeout: STATEMENT_TIMEOUT_MS,
  });
  await client.connect();
  try {
    return await werk(client);
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * Bouwt een kubus uit databaserijen.
 *
 * De dimensiewaarden worden hier tot een lijst met indexen samengevouwen — dat is waar
 * de payload klein van wordt: een campagnenaam van vijftig tekens staat één keer in
 * `labels` in plaats van in elk van de duizend rijen waar hij in voorkomt.
 */
function bouwKubus(
  rijen: Record<string, unknown>[],
  dimensies: string[],
  kolommen: string[],
  korrel: "dag" | "week",
  periode: { van: string; tot: string },
  metaVelden: { sleutel: string; velden: string[] } | null = null,
): Kubus {
  const labels: Record<string, string[]> = {};
  const index: Record<string, Map<string, number>> = {};
  for (const dim of dimensies) {
    labels[dim] = [];
    index[dim] = new Map();
  }

  const meta: Record<string, Record<string, string | null>> = {};
  const uit: number[][] = [];

  for (const rij of rijen) {
    const waarden: number[] = [];
    for (const dim of dimensies) {
      const rauw = rij[dim];
      const tekst = rauw === null || rauw === undefined || rauw === "" ? "—" : String(rauw);
      let i = index[dim].get(tekst);
      if (i === undefined) {
        i = labels[dim].length;
        labels[dim].push(tekst);
        index[dim].set(tekst, i);
      }
      waarden.push(i);
    }
    for (const kolom of kolommen) {
      const rauw = rij[kolom];
      // Postgres levert numeric als string terug; Number() daarop is exact genoeg voor
      // bedragen in euro's en aantallen.
      const getal = typeof rauw === "number" ? rauw : Number(rauw ?? 0);
      waarden.push(Number.isFinite(getal) ? getal : 0);
    }
    uit.push(waarden);

    if (metaVelden) {
      const sleutel = String(rij[metaVelden.sleutel] ?? "");
      if (sleutel && !meta[sleutel]) {
        const blok: Record<string, string | null> = {};
        for (const veld of metaVelden.velden) {
          const waarde = rij[veld];
          blok[veld] = waarde === null || waarde === undefined ? null : String(waarde);
        }
        meta[sleutel] = blok;
      }
    }
  }

  const kubus: Kubus = { dimensies, labels, kolommen, rijen: uit, korrel, periode };
  if (metaVelden) kubus.meta = meta;
  return kubus;
}

function dagenTussen(van: string, tot: string): number {
  const a = new Date(`${van}T00:00:00Z`).getTime();
  const b = new Date(`${tot}T00:00:00Z`).getTime();
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

/** Of de reeks per dag of per week wordt samengevat, en de bijbehorende SQL-uitdrukking. */
function korrelVoor(van: string, tot: string): { korrel: "dag" | "week"; sql: string } {
  if (dagenTussen(van, tot) <= DAG_KORREL_MAX_DAGEN) {
    return { korrel: "dag", sql: "datum" };
  }
  // date_trunc geeft de maandag van de ISO-week; dat is dezelfde weekindeling die
  // lib/kanalen/kubus.ts hanteert, zodat server en browser niet uiteenlopen.
  return { korrel: "week", sql: "date_trunc('week', datum)::date" };
}

// ---------------------------------------------------------------------------
// Advertenties
// ---------------------------------------------------------------------------

const ADVERTENTIE_METINGEN = [
  "uitgaven",
  "vertoningen",
  "bereik",
  "klikken",
  "link_klikken",
  "interacties",
  "videoweergaven",
  "leads",
  "conversies",
  "conversiewaarde",
];

const METINGEN_SOM = ADVERTENTIE_METINGEN.map((m) => `coalesce(sum(${m}), 0) as ${m}`).join(", ");

export type AdvertentieBron = "social" | "google";

/** Social ads is Meta plus LinkedIn; Google Ads staat op een eigen pagina. */
function bronFilter(bron: AdvertentieBron): string[] {
  return bron === "google" ? ["google"] : ["meta", "linkedin"];
}

export interface AdvertentieData {
  reeks: Kubus;
  detail: Kubus;
}

export async function haalAdvertenties(
  bron: AdvertentieBron,
  van: string,
  tot: string,
): Promise<AdvertentieData> {
  const { korrel, sql: datumSql } = korrelVoor(van, tot);
  const bronnen = bronFilter(bron);

  return metVerbinding(async (client) => {
    // Merk en categorie komen uit de koppeltabel en hangen aan de campagne, dus ze
    // splitsen de rijen niet verder op — maar ze maken wel het filter mogelijk dat de
    // koppeltabel al belooft ("werkt daarna als filter op Social ads en Google Ads").
    const reeksRes = await client.query(
      `select ${datumSql}::text as datum,
              account, platform, campagne, campagne_doel, campagne_status, campagnemanager,
              coalesce(merk, '—') as merk,
              coalesce(categorie, '—') as categorie,
              ${METINGEN_SOM}
         from dataloket.v_advertenties
        where datum between $1 and $2 and bron = any($3)
        group by 1, 2, 3, 4, 5, 6, 7, 8, 9
        order by 1`,
      [van, tot, bronnen],
    );

    // Groeperen op `advertentie_id` en niet op de naam: advertentienamen als
    // "Carrousel 1" komen in meerdere campagnes voor, en op naam groeperen telde die tot
    // één regel op — met de creative van willekeurig de eerste erbij. De leesbare naam
    // komt daarom uit de meta.
    const detailRes = await client.query(
      `select account, platform,
              coalesce(nullif(plaatsing, ''), '—') as plaatsing,
              campagne, campagne_doel, campagne_status, campagnemanager,
              coalesce(merk, '—') as merk,
              coalesce(categorie, '—') as categorie,
              coalesce(nullif(adgroep, ''), '—') as adgroep,
              coalesce(nullif(advertentie_id, ''), coalesce(nullif(advertentie, ''), '(zonder naam)')) as advertentie_id,
              min(coalesce(nullif(advertentie, ''), '(zonder naam)')) as advertentie,
              min(advertentie_status) as advertentie_status,
              min(thumbnail_url) as thumbnail_url,
              min(preview_url) as preview_url,
              ${METINGEN_SOM}
         from dataloket.v_advertenties
        where datum between $1 and $2 and bron = any($3)
        group by 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11
        order by sum(uitgaven) desc nulls last
        limit ${DETAIL_LIMIET}`,
      [van, tot, bronnen],
    );

    const detail = bouwKubus(
      detailRes.rows,
      ["account", "platform", "plaatsing", "campagne", "campagne_doel", "campagne_status", "campagnemanager", "merk", "categorie", "adgroep", "advertentie_id"],
      ADVERTENTIE_METINGEN,
      korrel,
      { van, tot },
      { sleutel: "advertentie_id", velden: ["advertentie", "thumbnail_url", "preview_url", "advertentie_status"] },
    );
    detail.afgekapt = detailRes.rows.length >= DETAIL_LIMIET;

    return {
      reeks: bouwKubus(
        reeksRes.rows,
        ["datum", "account", "platform", "campagne", "campagne_doel", "campagne_status", "campagnemanager", "merk", "categorie"],
        ADVERTENTIE_METINGEN,
        korrel,
        { van, tot },
      ),
      detail,
    };
  });
}

// ---------------------------------------------------------------------------
// Organische posts
// ---------------------------------------------------------------------------

const POST_METINGEN = [
  "vertoningen",
  "vertoningen_organisch",
  "vertoningen_betaald",
  "bereik",
  "interacties",
  "likes",
  "reacties",
  "opgeslagen",
  "gedeeld",
  "klikken",
  "nieuwe_volgers",
  "videoweergaven",
  "kijktijd_ms",
  "advertentie_uitgaven",
];

export interface PostData {
  reeks: Kubus;
  detail: Kubus;
}

/**
 * Posts zijn er maar een paar honderd per kwartaal, dus hier is geen opsplitsing nodig:
 * dezelfde rijen dragen zowel de tijdreeks als de tabel. `detail` houdt de posttekst en
 * de permalink erbij; `reeks` laat die weg omdat een tijdreeks er niets aan heeft.
 */
export async function haalPosts(van: string, tot: string): Promise<PostData> {
  const { korrel, sql: datumSql } = korrelVoor(van, tot);

  return metVerbinding(async (client) => {
    const reeksRes = await client.query(
      `select ${datumSql}::text as datum, bron, account, post_type,
              case when opgehoogd then 'Opgehoogd' else 'Alleen organisch' end as inzet,
              ${POST_METINGEN.map((m) => `coalesce(sum(${m}), 0) as ${m}`).join(", ")}
         from dataloket.v_posts
        where datum between $1 and $2
        group by 1, 2, 3, 4, 5
        order by 1`,
      [van, tot],
    );

    const detailRes = await client.query(
      `select post_id, datum::text as datum, bron, account, post_type,
              case when opgehoogd then 'Opgehoogd' else 'Alleen organisch' end as inzet,
              coalesce(nullif(left(tekst, 160), ''), '(zonder tekst)') as tekst,
              permalink, afbeelding_url,
              ${POST_METINGEN.map((m) => `coalesce(${m}, 0) as ${m}`).join(", ")}
         from dataloket.v_posts
        where datum between $1 and $2
        order by vertoningen_organisch desc nulls last
        limit ${DETAIL_LIMIET}`,
      [van, tot],
    );

    // Op `post_id` en niet op de tekst: twee posts met dezelfde caption — een
    // terugkerende actie, of dezelfde tekst onder een reel en een feedpost — vielen
    // anders samen tot één regel, en dan klopt de telling eronder ook niet meer.
    const detail = bouwKubus(
      detailRes.rows,
      ["datum", "bron", "account", "post_type", "inzet", "post_id"],
      POST_METINGEN,
      "dag",
      { van, tot },
      { sleutel: "post_id", velden: ["tekst", "permalink", "afbeelding_url"] },
    );
    detail.afgekapt = detailRes.rows.length >= DETAIL_LIMIET;

    return {
      reeks: bouwKubus(
        reeksRes.rows,
        ["datum", "bron", "account", "post_type", "inzet"],
        POST_METINGEN,
        korrel,
        { van, tot },
      ),
      detail,
    };
  });
}

// ---------------------------------------------------------------------------
// Accountontwikkeling
// ---------------------------------------------------------------------------

const ACCOUNT_SOMMEN = [
  "volgers_erbij",
  "volgers_eraf",
  "volgers_netto",
  "vertoningen",
  "vertoningen_organisch",
  "bereik",
  "interacties",
  "paginaweergaven",
  "aantal_posts",
];

/**
 * De volgersstand is een stand, geen som.
 *
 * Alle andere cijfers hier zijn dagwaarden die je mag optellen; het aantal volgers is de
 * stand op dat moment. Vier accounts met 10.000 volgers hebben er samen 40.000, maar
 * dezelfde vier op vier dagen hebben er nog steeds 40.000 en niet 160.000. De reeks
 * levert daarom `volgers` als de laatste stand per dag per account, en de pagina telt
 * hem alleen over accounts op — nooit over de tijd.
 */
export async function haalAccounts(van: string, tot: string): Promise<{ reeks: Kubus }> {
  const { korrel, sql: datumSql } = korrelVoor(van, tot);

  return metVerbinding(async (client) => {
    const res = await client.query(
      `select ${datumSql}::text as datum, bron, account,
              case when bool_or(volgers_geschat) then 'Eigen meting' else 'Platformhistorie' end as herkomst,
              -- Bij een weekkorrel is de stand aan het eind van de week de juiste, niet
              -- de som van zeven standen.
              coalesce((array_agg(volgers order by datum desc) filter (where volgers is not null))[1], 0) as volgers,
              ${ACCOUNT_SOMMEN.map((m) => `coalesce(sum(${m}), 0) as ${m}`).join(", ")}
         from dataloket.v_account_ontwikkeling
        where datum between $1 and $2
        group by 1, 2, 3
        order by 1`,
      [van, tot],
    );

    const reeks = bouwKubus(
      res.rows,
      ["datum", "bron", "account", "herkomst"],
      ["volgers", ...ACCOUNT_SOMMEN],
      korrel,
      { van, tot },
    );
    // `volgers` is de enige kolom in het hele dashboard die een stand meet en geen
    // stroom. Zonder deze markering telt de pagina dertig dagstanden bij elkaar op en
    // staat er 2,3 miljoen volgers waar er tachtigduizend horen te staan.
    reeks.standKolommen = ["volgers"];
    reeks.standPer = "account";
    return { reeks };
  });
}

// ---------------------------------------------------------------------------
// Koppeltabel
// ---------------------------------------------------------------------------

export interface Koppeling {
  campagne: string;
  bron: string | null;
  eigenaarNaam: string | null;
  merk: string | null;
  categorie: string | null;
  sheetCampagne: string | null;
  notitie: string | null;
  /** Uitgaven over de laatste 90 dagen — zegt hoe urgent een ontbrekende koppeling is. */
  uitgaven: number;
  gekoppeld: boolean;
}

/**
 * Alle campagnes die in de data voorkomen, met hun koppeling als die er is.
 *
 * Een left join vanuit de advertentiedata en niet vanuit de koppeltabel: de pagina moet
 * juist laten zien wat er nog níet gekoppeld is. Een koppeling die je niet kunt zien
 * ontbreken, gaat niemand onderhouden.
 */
export async function haalKoppelingen(): Promise<Koppeling[]> {
  return metVerbinding(async (client) => {
    const res = await client.query(
      `select c.campagne,
              c.bron,
              k.eigenaar_naam,
              k.merk,
              k.categorie,
              k.sheet_campagne,
              k.notitie,
              c.uitgaven,
              -- "Gekoppeld" is: er staat een campagnemanager. Dit stond eerst op
              -- "er bestaat een rij", en dan gold een campagne waarvan alleen het merk
              -- was ingevuld al als geregeld — terwijl de teller erboven "zonder
              -- campagnemanager" telt.
              (coalesce(nullif(btrim(k.eigenaar_naam), ''), null) is not null) as gekoppeld
         from (
           select campagne, min(bron) as bron, coalesce(sum(uitgaven), 0) as uitgaven
             from dataloket.v_advertenties
            where datum >= current_date - interval '90 days'
            group by campagne
         ) c
         left join dataloket.windsor_campagne_eigenaar k on k.campagne = c.campagne
        order by c.uitgaven desc nulls last`,
    );

    return res.rows.map((r) => ({
      campagne: String(r.campagne),
      bron: r.bron ? String(r.bron) : null,
      eigenaarNaam: r.eigenaar_naam ? String(r.eigenaar_naam) : null,
      merk: r.merk ? String(r.merk) : null,
      categorie: r.categorie ? String(r.categorie) : null,
      sheetCampagne: r.sheet_campagne ? String(r.sheet_campagne) : null,
      notitie: r.notitie ? String(r.notitie) : null,
      uitgaven: Number(r.uitgaven ?? 0),
      gekoppeld: Boolean(r.gekoppeld),
    }));
  });
}

/** Wanneer draaide de laatste geslaagde Windsor-sync? Staat in de paginakop. */
export async function haalLaatsteSync(): Promise<string | null> {
  return metVerbinding(async (client) => {
    const res = await client.query(
      `select max(geeindigd_op) as moment
         from dataloket.sync_runs
        where bron like 'windsor%' and gelukt = true`,
    );
    const moment = res.rows[0]?.moment;
    return moment ? new Date(moment as string).toISOString() : null;
  });
}
