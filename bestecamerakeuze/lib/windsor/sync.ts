/**
 * De nachtelijke sync van Windsor.ai naar Postgres.
 *
 * ## Waarom een voortschrijdend venster en geen "alleen gisteren"
 *
 * Meta en Google herzien hun cijfers nog dagen na dato: een conversie die vandaag wordt
 * toegeschreven aan een klik van vorige week, verandert het getal van vorige week. Wie
 * alleen gisteren ophaalt, bevriest die eerste, te lage schatting voor altijd. Daarom
 * haalt de sync standaard de laatste dertig dagen opnieuw op en overschrijft wat er
 * stond. Dat kost een paar minuten per nacht en scheelt een dashboard dat structureel
 * te weinig conversies laat zien.
 *
 * ## Waarom organische posts niet op datum maar op post-id
 *
 * Een organische post levert lifetime-cijfers op zijn publicatiedatum. Een post van
 * vorige maand pikt nog bereik op; dat hoort bij die post, niet bij vandaag. De upsert
 * gaat daarom op post_id, en de rij blijft op zijn oorspronkelijke datum staan.
 *
 * ## Waarom Instagram apart wordt behandeld
 *
 * `followers_count` negeert de opgegeven periode en geeft altijd precies één rij met de
 * stand van vandaag. Historie bestaat dus niet — wij maken hem, door elke nacht die ene
 * stand weg te schrijven op de datum van vandaag. Die rijen krijgen
 * `volgers_geschat = true`, zodat de grafiek eerlijk kan tonen dat de reeks bij ons
 * begint en niet bij het platform.
 */

import type { Client } from "pg";
import {
  getal,
  haalOp,
  haalVeldcatalogus,
  tekst,
  type Connector,
  type WindsorRij,
} from "@/lib/windsor/api";
import {
  OPHAALVELDEN,
  PAGINAVELDEN,
  isConversieActie,
  labelVoorConversie,
} from "@/lib/windsor/velden";

/** Hoeveel dagen terug de sync standaard opnieuw ophaalt. */
export const VENSTER_DAGEN = 30;

export interface SyncResultaat {
  onderdeel: string;
  gelezen: number;
  geschreven: number;
  duurMs: number;
  fout?: string;
}

function datumTekst(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function standaardVenster(dagen = VENSTER_DAGEN): { van: string; tot: string } {
  const tot = new Date();
  const van = new Date(tot);
  van.setUTCDate(van.getUTCDate() - dagen);
  return { van: datumTekst(van), tot: datumTekst(tot) };
}

// ---------------------------------------------------------------------------
// Maatwerkconversies ontdekken
// ---------------------------------------------------------------------------

/**
 * Leest de veldcatalogus van Windsor en houdt `windsor_conversie_acties` bij.
 *
 * Nieuwe acties komen erbij met een automatisch label; bestaande rijen waar iemand het
 * label of de standaard-vlag met de hand heeft bijgesteld (`gewijzigd = true`) worden
 * met rust gelaten. Zo kan marketing morgen een conversie aanzetten in Google Ads en
 * staat hij overmorgen in het dashboard, zonder dat iemand code hoeft aan te raken —
 * en zonder dat een handmatig gecorrigeerd label weer wordt overschreven.
 */
export async function syncConversieActies(client: Client): Promise<{
  velden: Record<"facebook" | "google_ads", string[]>;
  nieuw: number;
}> {
  const catalogus = await haalVeldcatalogus();
  const velden: Record<"facebook" | "google_ads", string[]> = {
    facebook: [],
    google_ads: [],
  };

  const vandaag = datumTekst(new Date());
  let nieuw = 0;

  for (const veld of catalogus) {
    for (const connector of veld.available_in_connectors ?? []) {
      if (connector !== "facebook" && connector !== "google_ads") continue;
      if (!isConversieActie(veld.id, connector)) continue;

      velden[connector].push(veld.id);
      const res = await client.query(
        `insert into dataloket.windsor_conversie_acties (veld, bron, label, laatst_gezien)
         values ($1, $2, $3, $4)
         on conflict (veld) do update
           set laatst_gezien = excluded.laatst_gezien,
               label = case when dataloket.windsor_conversie_acties.gewijzigd
                            then dataloket.windsor_conversie_acties.label
                            else excluded.label end
         returning (xmax = 0) as is_nieuw`,
        [
          veld.id,
          connector === "facebook" ? "meta" : "google",
          labelVoorConversie(veld.id),
          vandaag,
        ],
      );
      if (res.rows[0]?.is_nieuw) nieuw++;
    }
  }

  return { velden, nieuw };
}

/** Plukt de maatwerkconversies met een waarde uit een rij; nullen laten we weg. */
function conversiesUit(rij: WindsorRij, velden: string[]): Record<string, number> {
  const uit: Record<string, number> = {};
  for (const veld of velden) {
    const waarde = getal(rij[veld]);
    if (waarde) uit[veld] = waarde;
  }
  return uit;
}

// ---------------------------------------------------------------------------
// Schrijven
// ---------------------------------------------------------------------------

/**
 * Schrijft rijen weg in batches van één multi-row insert.
 *
 * Rij voor rij insert'en zoals de sheet-sync doet werkt daar prima (duizenden rijen),
 * maar hier gaat het om tienduizenden per nacht en dan is één round-trip per rij de
 * traagste schakel van de hele job.
 */
async function schrijfBatch(
  client: Client,
  tabel: string,
  kolommen: string[],
  rijen: unknown[][],
  conflictSleutel: string,
): Promise<number> {
  if (rijen.length === 0) return 0;

  // De rijen zijn arrays op positie, niet objecten op naam. Eén vergeten waarde
  // verschuift alles erna een plek op, en dan landt het uitgavenbedrag stilletjes in de
  // kolom "bereik" — een fout die je pas maanden later in een grafiek terugziet. Deze
  // controle kost niets en maakt er een harde, meteen zichtbare fout van.
  const scheef = rijen.findIndex((rij) => rij.length !== kolommen.length);
  if (scheef !== -1) {
    throw new Error(
      `${tabel}: rij ${scheef} heeft ${rijen[scheef].length} waarden, ` +
        `maar er zijn ${kolommen.length} kolommen`,
    );
  }

  const BATCH = 500;
  const bijwerken = kolommen
    .filter((k) => !conflictSleutel.includes(k))
    .map((k) => `${k} = excluded.${k}`)
    .join(", ");

  let geschreven = 0;
  for (let i = 0; i < rijen.length; i += BATCH) {
    const deel = rijen.slice(i, i + BATCH);
    const waarden: unknown[] = [];
    const groepen = deel.map((rij) => {
      const plaatshouders = rij.map((waarde) => {
        waarden.push(waarde);
        return `$${waarden.length}`;
      });
      return `(${plaatshouders.join(", ")})`;
    });

    await client.query(
      `insert into dataloket.${tabel} (${kolommen.join(", ")})
       values ${groepen.join(", ")}
       on conflict (${conflictSleutel}) do update set ${bijwerken}`,
      waarden,
    );
    geschreven += deel.length;
  }
  return geschreven;
}

// ---------------------------------------------------------------------------
// Advertenties
// ---------------------------------------------------------------------------

const ADVERTENTIE_KOLOMMEN = [
  "datum",
  "bron",
  "account_id",
  "account_naam",
  "platform",
  "plaatsing",
  "campagne_id",
  "campagne",
  "campagne_doel",
  "campagne_status",
  "adgroep_id",
  "adgroep",
  "advertentie_id",
  "advertentie",
  "advertentie_status",
  "thumbnail_url",
  "preview_url",
  "bestemming_url",
  "meta_post_id",
  "instagram_permalink",
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
  "conversie_acties",
];

const ADVERTENTIE_SLEUTEL =
  "datum, bron, account_id, platform, plaatsing, campagne_id, advertentie_id";

/**
 * Meta Ads.
 *
 * Let op het verschil tussen `bron` en `platform`: alles hieronder heeft bron 'meta',
 * maar het platform kan facebook, instagram of threads zijn. Het dashboard filtert op
 * platform, want dáár draaide de advertentie. De Instagram-connector bevat géén
 * advertenties — die is puur organisch.
 */
export async function syncMetaAds(
  client: Client,
  van: string,
  tot: string,
  conversieVelden: string[],
): Promise<SyncResultaat> {
  const start = Date.now();
  const velden = [...OPHAALVELDEN.facebook, ...conversieVelden];
  const rijen = await haalOp("facebook", velden, van, tot);

  const uit = rijen.map((r) => [
    r.date,
    "meta",
    tekst(r.account_id) ?? "",
    tekst(r.account_name),
    tekst(r.publisher_platform) ?? "facebook",
    tekst(r.platform_position) ?? "",
    tekst(r.campaign_id) ?? "",
    tekst(r.campaign) ?? "(zonder naam)",
    tekst(r.campaign_objective),
    tekst(r.campaign_effective_status),
    tekst(r.adset_id),
    tekst(r.adset_name),
    tekst(r.ad_id) ?? "",
    tekst(r.ad_name),
    tekst(r.effective_status),
    tekst(r.thumbnail_url),
    tekst(r.ad_preview_shareable_link),
    tekst(r.website_destination_url),
    tekst(r.effective_object_story_id),
    tekst(r.instagram_permalink_url),
    getal(r.spend),
    getal(r.impressions),
    getal(r.reach),
    getal(r.clicks),
    getal(r.actions_link_click),
    getal(r.actions_post_engagement),
    getal(r.actions_video_view),
    getal(r.actions_lead),
    // Meta kent geen kale "conversions": de som van de maatwerkconversies ís het
    // conversietotaal voor dit account.
    Object.values(conversiesUit(r, conversieVelden)).reduce((a, b) => a + b, 0),
    0,
    JSON.stringify(conversiesUit(r, conversieVelden)),
  ]);

  const geschreven = await schrijfBatch(
    client,
    "windsor_advertenties",
    ADVERTENTIE_KOLOMMEN,
    ontdubbel(uit),
    ADVERTENTIE_SLEUTEL,
  );
  return { onderdeel: "meta-ads", gelezen: rijen.length, geschreven, duurMs: Date.now() - start };
}

export async function syncGoogleAds(
  client: Client,
  van: string,
  tot: string,
  conversieVelden: string[],
): Promise<SyncResultaat> {
  const start = Date.now();
  const velden = [...OPHAALVELDEN.google_ads, ...conversieVelden];
  const rijen = await haalOp("google_ads", velden, van, tot);

  const uit = rijen.map((r) => [
    r.date,
    "google",
    tekst(r.account_id) ?? "",
    tekst(r.account_name),
    "google",
    "",
    tekst(r.campaign_id) ?? "",
    tekst(r.campaign) ?? "(zonder naam)",
    tekst(r.campaign_type),
    tekst(r.campaign_status),
    tekst(r.ad_group_id),
    tekst(r.ad_group_name),
    tekst(r.ad_id) ?? "",
    tekst(r.ad_group_ad_ad_type),
    null,
    null,
    null,
    tekst(r.ad_group_ad_ad_final_urls),
    null,
    null,
    getal(r.spend),
    getal(r.impressions),
    0, // Google Ads levert geen bereik op advertentieniveau.
    getal(r.clicks),
    getal(r.clicks),
    getal(r.engagements),
    getal(r.video_trueview_views),
    0, // Leads zitten bij Google in de conversie-acties, niet in een apart veld.
    getal(r.conversions),
    getal(r.conversions_value),
    JSON.stringify(conversiesUit(r, conversieVelden)),
  ]);

  const geschreven = await schrijfBatch(
    client,
    "windsor_advertenties",
    ADVERTENTIE_KOLOMMEN,
    ontdubbel(uit),
    ADVERTENTIE_SLEUTEL,
  );
  return { onderdeel: "google-ads", gelezen: rijen.length, geschreven, duurMs: Date.now() - start };
}

export async function syncLinkedInAds(
  client: Client,
  van: string,
  tot: string,
): Promise<SyncResultaat> {
  const start = Date.now();
  const rijen = await haalOp("linkedin", OPHAALVELDEN.linkedin, van, tot);

  const uit = rijen.map((r) => [
    r.date,
    "linkedin",
    tekst(r.account_id) ?? "",
    tekst(r.account_name),
    "linkedin",
    "",
    tekst(r.campaign_id) ?? "",
    tekst(r.campaign) ?? "(zonder naam)",
    // LinkedIn draait de begrippen om: wat de UI een campagne noemt heet in de API een
    // campaign group, en wat de API een campaign noemt is in de UI een ad set. De
    // groepsnaam is dus wat een marketeer als doel/thema herkent.
    tekst(r.campaign_group_name),
    null,
    null,
    tekst(r.campaign_group_name),
    tekst(r.creative_id) ?? "",
    null,
    null,
    tekst(r.creative_thumbnail),
    null,
    null,
    null,
    null,
    getal(r.spend),
    getal(r.impressions),
    getal(r.approximate_unique_impressions),
    getal(r.clicks),
    getal(r.landingpageclicks),
    getal(r.total_engagements),
    getal(r.video_views),
    getal(r.oneclickleads),
    getal(r.externalwebsiteconversions),
    getal(r.conversionvalueinlocalcurrency),
    "{}",
  ]);

  const geschreven = await schrijfBatch(
    client,
    "windsor_advertenties",
    ADVERTENTIE_KOLOMMEN,
    ontdubbel(uit),
    ADVERTENTIE_SLEUTEL,
  );
  return {
    onderdeel: "linkedin-ads",
    gelezen: rijen.length,
    geschreven,
    duurMs: Date.now() - start,
  };
}

/**
 * Houdt binnen één batch de laatste rij per sleutel over.
 *
 * `insert … on conflict do update` mag binnen één statement dezelfde rij niet twee keer
 * raken ("ON CONFLICT DO UPDATE command cannot affect row a second time"). Windsor kan
 * twee rijen met dezelfde sleutel leveren zodra een breakdown-veld leeg terugkomt, en
 * dan sneuvelt de hele batch. Ontdubbelen vóór het schrijven is goedkoper dan per rij
 * insert'en.
 */
function ontdubbel(rijen: unknown[][]): unknown[][] {
  // De sleutelkolommen van windsor_advertenties, op positie in ADVERTENTIE_KOLOMMEN.
  const sleutelIndexen = [0, 1, 2, 4, 5, 6, 12];
  const gezien = new Map<string, unknown[]>();
  for (const rij of rijen) {
    gezien.set(sleutelIndexen.map((i) => String(rij[i])).join(" "), rij);
  }
  return [...gezien.values()];
}

// ---------------------------------------------------------------------------
// Organische posts
// ---------------------------------------------------------------------------

const POST_KOLOMMEN = [
  "post_id",
  "bron",
  "account_id",
  "account_naam",
  "gepubliceerd_op",
  "datum",
  "post_type",
  "tekst",
  "permalink",
  "afbeelding_url",
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
];

/** Houdt de laatste rij per post-id over; zie de toelichting bij `ontdubbel`. */
function ontdubbelPosts(rijen: unknown[][]): unknown[][] {
  const gezien = new Map<string, unknown[]>();
  for (const rij of rijen) gezien.set(String(rij[0]), rij);
  return [...gezien.values()];
}

/** De datum waarop een post in de grafiek hoort: zijn publicatiemoment. */
function postDatum(tijdstip: unknown, terugval: unknown): string | null {
  const t = tekst(tijdstip);
  if (t && t.length >= 10) return t.slice(0, 10);
  return tekst(terugval);
}

export async function syncFacebookPosts(
  client: Client,
  van: string,
  tot: string,
): Promise<SyncResultaat> {
  const start = Date.now();
  const rijen = await haalOp("facebook_organic", OPHAALVELDEN.facebook_organic, van, tot);

  const uit = rijen
    .filter((r) => tekst(r.post_id))
    .map((r) => [
      tekst(r.post_id),
      "facebook",
      tekst(r.page_id) ?? tekst(r.account_id) ?? "",
      tekst(r.account_name),
      tekst(r.post_created_time),
      postDatum(r.post_created_time, r.date),
      tekst(r.type),
      tekst(r.post_message_oneline),
      tekst(r.permalink_url),
      tekst(r.full_picture),
      getal(r.post_impressions),
      getal(r.post_impressions_organic),
      getal(r.post_impressions_paid),
      getal(r.post_impressions_unique),
      getal(r.post_engagements),
      0, // Facebook splitst likes/reacties/opslagen niet per post in deze connector;
      0, // post_engagements is het totaal dat de UI ook toont.
      0,
      0,
      0,
      getal(r.post_video_followers),
      getal(r.post_video_views_organic),
      0,
    ]);

  const geschreven = await schrijfBatch(
    client,
    "windsor_posts",
    POST_KOLOMMEN,
    ontdubbelPosts(uit),
    "post_id",
  );
  return {
    onderdeel: "facebook-posts",
    gelezen: rijen.length,
    geschreven,
    duurMs: Date.now() - start,
  };
}

export async function syncInstagramPosts(
  client: Client,
  van: string,
  tot: string,
): Promise<SyncResultaat> {
  const start = Date.now();
  const rijen = await haalOp("instagram", OPHAALVELDEN.instagram, van, tot);

  const uit = rijen
    .filter((r) => tekst(r.media_id))
    .map((r) => [
      tekst(r.media_id),
      "instagram",
      tekst(r.account_id) ?? "",
      tekst(r.account_name) ?? tekst(r.username),
      tekst(r.timestamp),
      postDatum(r.timestamp, r.date),
      (tekst(r.media_product_type) ?? "").toLowerCase() || null,
      tekst(r.media_caption),
      tekst(r.media_permalink),
      tekst(r.media_url),
      getal(r.media_views),
      // Instagram Insights kent geen betaalde/organische splitsing per post; alles wat
      // hier binnenkomt is de organische weergave van de post.
      getal(r.media_views),
      0,
      getal(r.media_reach),
      getal(r.media_engagement),
      getal(r.media_like_count),
      getal(r.media_comments_count),
      getal(r.media_saved),
      getal(r.media_shares),
      0,
      getal(r.media_follows),
      0,
      getal(r.media_reel_total_watch_time),
    ]);

  const geschreven = await schrijfBatch(
    client,
    "windsor_posts",
    POST_KOLOMMEN,
    ontdubbelPosts(uit),
    "post_id",
  );
  return {
    onderdeel: "instagram-posts",
    gelezen: rijen.length,
    geschreven,
    duurMs: Date.now() - start,
  };
}

export async function syncLinkedInPosts(
  client: Client,
  van: string,
  tot: string,
): Promise<SyncResultaat> {
  const start = Date.now();
  const rijen = await haalOp("linkedin_organic", OPHAALVELDEN.linkedin_organic, van, tot);

  const uit = rijen
    .filter((r) => tekst(r.post_id) && tekst(r.date))
    .map((r) => [
      tekst(r.post_id),
      "linkedin",
      tekst(r.account_id) ?? "",
      tekst(r.organization_name) ?? tekst(r.account_name),
      null,
      tekst(r.date),
      tekst(r.share_post_type),
      tekst(r.share_text),
      tekst(r.share_url),
      null,
      getal(r.share_impression_count),
      getal(r.share_impression_count),
      0,
      getal(r.share_unique_impressions_count),
      getal(r.share_total_engagements),
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
    ]);

  const geschreven = await schrijfBatch(
    client,
    "windsor_posts",
    POST_KOLOMMEN,
    ontdubbelPosts(uit),
    "post_id",
  );
  return {
    onderdeel: "linkedin-posts",
    gelezen: rijen.length,
    geschreven,
    duurMs: Date.now() - start,
  };
}

/**
 * Markeert welke organische posts ook als advertentie zijn ingezet, en hoeveel daaraan
 * is uitgegeven.
 *
 * Dit is de koppeling die geen enkel platform zelf toont. Meta levert bij elke
 * advertentie `effective_object_story_id` in precies het formaat van het Facebook
 * post-id, en een `instagram_permalink_url` die de permalink uit Instagram Insights
 * matcht. Draait één keer na het schrijven van beide kanten, zodat de organische pagina
 * per post kan laten zien wat er organisch gebeurde en wat het geld eraan toevoegde.
 */
export async function koppelPostsAanAdvertenties(client: Client): Promise<SyncResultaat> {
  const start = Date.now();

  // Eerst alles terugzetten: een post die vorige maand werd opgehoogd en nu niet meer,
  // hoort niet voor altijd als "betaald" gemarkeerd te blijven staan. Alleen de posts
  // die in dit venster opnieuw gekoppeld worden, krijgen de vlag weer.
  await client.query(
    `update dataloket.windsor_posts
        set opgehoogd = false, advertentie_uitgaven = 0
      where opgehoogd = true`,
  );

  // Facebook: het advertentieveld is letterlijk het post-id van de organische post.
  const facebook = await client.query(`
    update dataloket.windsor_posts p
       set opgehoogd = true,
           advertentie_uitgaven = b.uitgaven
      from (
        select meta_post_id, sum(uitgaven) as uitgaven
          from dataloket.windsor_advertenties
         where bron = 'meta' and meta_post_id is not null
         group by meta_post_id
      ) b
     where p.bron = 'facebook'
       and p.post_id = b.meta_post_id
  `);

  // Instagram: de permalink van de advertentie is die van de post. De Instagram-
  // permalink staat op elke Meta-advertentierij, ook op de rijen met platform
  // 'facebook' — vandaar de som over álle meta-rijen met deze permalink, niet alleen
  // die met platform 'instagram'.
  const instagram = await client.query(`
    update dataloket.windsor_posts p
       set opgehoogd = true,
           advertentie_uitgaven = b.uitgaven
      from (
        select instagram_permalink, sum(uitgaven) as uitgaven
          from dataloket.windsor_advertenties
         where bron = 'meta' and instagram_permalink is not null
         group by instagram_permalink
      ) b
     where p.bron = 'instagram'
       and p.permalink = b.instagram_permalink
  `);

  const geraakt = (facebook.rowCount ?? 0) + (instagram.rowCount ?? 0);
  return {
    onderdeel: "post-advertentie-koppeling",
    gelezen: geraakt,
    geschreven: geraakt,
    duurMs: Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// Accountontwikkeling
// ---------------------------------------------------------------------------

const ACCOUNT_KOLOMMEN = [
  "datum",
  "bron",
  "account_id",
  "account_naam",
  "volgers",
  "volgers_geschat",
  "volgers_erbij",
  "volgers_eraf",
  "volgers_erbij_betaald",
  "vertoningen",
  "vertoningen_organisch",
  "bereik",
  "interacties",
  "paginaweergaven",
  "aantal_posts",
];

const ACCOUNT_SLEUTEL = "datum, bron, account_id";

/** Houdt per (datum, bron, account) de laatste rij over; zie `ontdubbel`. */
function ontdubbelAccount(rijen: unknown[][]): unknown[][] {
  const gezien = new Map<string, unknown[]>();
  for (const rij of rijen) gezien.set(`${rij[0]} ${rij[1]} ${rij[2]}`, rij);
  return [...gezien.values()];
}

export async function syncFacebookPagina(
  client: Client,
  van: string,
  tot: string,
): Promise<SyncResultaat> {
  const start = Date.now();
  const velden = PAGINAVELDEN.facebook_organic ?? [];
  const rijen = await haalOp("facebook_organic", velden, van, tot);

  const uit = rijen
    .filter((r) => tekst(r.date))
    .map((r) => [
      tekst(r.date),
      "facebook",
      tekst(r.account_id) ?? "",
      tekst(r.page_name) ?? tekst(r.account_name),
      // page_follows is het aantal volgers, page_fans het aantal pagina-likes. Volgers
      // is wat de rest van het dashboard "volgers" noemt; bij pagina's die nooit zijn
      // omgezet zijn de twee gelijk.
      getal(r.page_follows) || getal(r.page_fans) || null,
      false,
      getal(r.page_daily_follows),
      getal(r.page_daily_unfollows),
      null,
      getal(r.page_impressions),
      getal(r.page_impressions_organic),
      getal(r.page_impressions_unique),
      getal(r.page_post_engagements),
      getal(r.page_views_total),
      0,
    ]);

  const geschreven = await schrijfBatch(
    client,
    "windsor_account_dag",
    ACCOUNT_KOLOMMEN,
    ontdubbelAccount(uit),
    ACCOUNT_SLEUTEL,
  );
  return {
    onderdeel: "facebook-pagina",
    gelezen: rijen.length,
    geschreven,
    duurMs: Date.now() - start,
  };
}

/**
 * LinkedIn-bedrijfspagina's.
 *
 * Windsor levert hier twee soorten rijen voor dezelfde dag: één met de paginaweergaven
 * en lege volgercijfers, één met de volgercijfers en lege paginaweergaven. Ze moeten dus
 * worden samengevoegd vóór het schrijven — anders overschrijft de tweede rij de eerste
 * en verdwijnt telkens de helft van de cijfers.
 */
export async function syncLinkedInPagina(
  client: Client,
  van: string,
  tot: string,
): Promise<SyncResultaat> {
  const start = Date.now();
  const velden = PAGINAVELDEN.linkedin_organic ?? [];
  const rijen = await haalOp("linkedin_organic", velden, van, tot);

  interface Samengevoegd {
    naam: string | null;
    volgers: number | null;
    erbij: number;
    erbijBetaald: number;
    vertoningen: number;
    interacties: number;
    paginaweergaven: number;
  }
  const perDag = new Map<string, Samengevoegd>();

  for (const r of rijen) {
    const datum = tekst(r.date);
    const account = tekst(r.account_id);
    if (!datum || !account) continue;

    const sleutel = `${datum}|${account}`;
    const huidig: Samengevoegd = perDag.get(sleutel) ?? {
      naam: null,
      volgers: null,
      erbij: 0,
      erbijBetaald: 0,
      vertoningen: 0,
      interacties: 0,
      paginaweergaven: 0,
    };

    huidig.naam = huidig.naam ?? tekst(r.organization_name) ?? tekst(r.account_name);
    const volgers = getal(r.organization_follower_count);
    if (volgers) huidig.volgers = volgers;
    huidig.erbij += getal(r.followers_gain_organic);
    huidig.erbijBetaald += getal(r.followers_gain_paid);
    huidig.vertoningen += getal(r.account_analytics_impression_count);
    huidig.interacties += getal(r.account_analytics_total_engagements);
    huidig.paginaweergaven += getal(r.all_page_views);

    perDag.set(sleutel, huidig);
  }

  const uit = [...perDag.entries()].map(([sleutel, w]) => {
    const [datum, account] = sleutel.split("|");
    return [
      datum,
      "linkedin",
      account,
      w.naam,
      w.volgers,
      false,
      w.erbij,
      // LinkedIn rapporteert alleen aanwas, geen vertrek. Nul in plaats van null zou
      // suggereren dat er niemand vertrok; null zegt eerlijk "niet gemeten".
      null,
      w.erbijBetaald,
      w.vertoningen,
      w.vertoningen,
      0,
      w.interacties,
      w.paginaweergaven,
      0,
    ];
  });

  const geschreven = await schrijfBatch(
    client,
    "windsor_account_dag",
    ACCOUNT_KOLOMMEN,
    ontdubbelAccount(uit),
    ACCOUNT_SLEUTEL,
  );
  return {
    onderdeel: "linkedin-pagina",
    gelezen: rijen.length,
    geschreven,
    duurMs: Date.now() - start,
  };
}

/**
 * Instagram — de momentopname die de historie moet worden.
 *
 * Twee opvragingen, want de API laat ze niet combineren:
 *
 *  1. `followers_count` negeert de periode volledig en geeft één rij per account met de
 *     stand van vandaag. Die schrijven we weg op de datum van vandaag. Draait de sync
 *     een nacht niet, dan ontbreekt die dag voorgoed — de grafiek moet dus tegen gaten
 *     kunnen, en dat is precies waarom `volgers_geschat` bestaat.
 *  2. De dagcijfers (bereik, interacties, nieuwe volgers) werken wél over een periode,
 *     maar niet verder terug dan dertig dagen. Het venster van de sync valt daar precies
 *     binnen; een langere handmatige run wordt hier afgekapt in plaats van te falen.
 */
export async function syncInstagramAccount(
  client: Client,
  van: string,
  tot: string,
): Promise<SyncResultaat> {
  const start = Date.now();
  const vandaag = datumTekst(new Date());

  // Het venster van deze connector is dertig dagen; verder terug weigert de API.
  const vroegst = new Date();
  vroegst.setUTCDate(vroegst.getUTCDate() - 29);
  const vanBeperkt = van < datumTekst(vroegst) ? datumTekst(vroegst) : van;

  const dagcijfers = await haalOp(
    "instagram",
    [
      "date",
      "account_id",
      "account_name",
      "username",
      "follower_count_1d",
      "reach",
      "accounts_engaged",
      "total_interactions",
    ],
    vanBeperkt,
    tot,
  );

  const standen = await haalOp(
    "instagram",
    ["date", "account_id", "account_name", "username", "followers_count", "media_count"],
    vandaag,
    vandaag,
  );

  const volgersNu = new Map<string, number>();
  const naamVan = new Map<string, string | null>();
  for (const r of standen) {
    const account = tekst(r.account_id);
    if (!account) continue;
    volgersNu.set(account, getal(r.followers_count));
    naamVan.set(account, tekst(r.account_name) ?? tekst(r.username));
  }

  const uit = dagcijfers
    .filter((r) => tekst(r.date) && tekst(r.account_id))
    .map((r) => {
      const account = tekst(r.account_id) as string;
      const datum = tekst(r.date) as string;
      return [
        datum,
        "instagram",
        account,
        naamVan.get(account) ?? tekst(r.account_name) ?? tekst(r.username),
        // Alleen op vandaag kennen we de echte stand; voor eerdere dagen laten we
        // volgers leeg in plaats van terug te rekenen. Terugrekenen uit de dagelijkse
        // aanwas klopt niet — dat cijfer telt alleen nieuwe volgers, geen vertrokken.
        datum === vandaag ? (volgersNu.get(account) ?? null) : null,
        true,
        getal(r.follower_count_1d),
        null,
        null,
        0,
        0,
        getal(r.reach),
        getal(r.total_interactions),
        // Instagram heeft geen werkend profielbezoek-cijfer meer: zowel `profile_views`
        // als `profile_views_1d` zijn door Meta afgevoerd en leveren altijd leeg op.
        // Een nul is hier eerlijker dan een vervangend cijfer dat iets anders meet.
        0,
        0,
      ];
    });

  // Accounts die vandaag geen dagcijfers hadden, krijgen alsnog hun momentopname —
  // anders ontbreekt die dag in de reeks zodra een account even stil is.
  for (const [account, volgers] of volgersNu) {
    if (uit.some((rij) => rij[0] === vandaag && rij[2] === account)) continue;
    uit.push([
      vandaag,
      "instagram",
      account,
      naamVan.get(account) ?? null,
      volgers,
      true,
      0,
      null,
      null,
      0,
      0,
      0,
      0,
      0,
      0,
    ]);
  }

  const geschreven = await schrijfBatch(
    client,
    "windsor_account_dag",
    ACCOUNT_KOLOMMEN,
    ontdubbelAccount(uit),
    ACCOUNT_SLEUTEL,
  );
  return {
    onderdeel: "instagram-account",
    gelezen: dagcijfers.length + standen.length,
    geschreven,
    duurMs: Date.now() - start,
  };
}

/**
 * Telt per dag en account hoeveel er is gepubliceerd.
 *
 * Draait ná de posts, uit de posttabel zelf: het aantal posts is een eigenschap van wat
 * we hebben opgeslagen, niet iets dat de API apart levert.
 */
export async function telPostsPerDag(client: Client, van: string): Promise<SyncResultaat> {
  const start = Date.now();
  const res = await client.query(
    `update dataloket.windsor_account_dag a
        set aantal_posts = t.aantal
       from (
         select datum, bron, account_id, count(*) as aantal
           from dataloket.windsor_posts
          where datum >= $1
          group by datum, bron, account_id
       ) t
      where a.datum = t.datum and a.bron = t.bron and a.account_id = t.account_id`,
    [van],
  );
  return {
    onderdeel: "posts-per-dag",
    gelezen: res.rowCount ?? 0,
    geschreven: res.rowCount ?? 0,
    duurMs: Date.now() - start,
  };
}
