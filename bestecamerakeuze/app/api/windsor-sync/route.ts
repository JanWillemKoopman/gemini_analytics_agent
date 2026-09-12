import { NextResponse } from "next/server";
import { Client } from "pg";
import { isWindsorGeconfigureerd } from "@/lib/windsor/api";
import {
  VENSTER_DAGEN,
  koppelPostsAanAdvertenties,
  standaardVenster,
  syncConversieActies,
  syncFacebookPagina,
  syncFacebookPosts,
  syncGoogleAds,
  syncInstagramAccount,
  syncInstagramPosts,
  syncLinkedInAds,
  syncLinkedInPagina,
  syncLinkedInPosts,
  syncMetaAds,
  telPostsPerDag,
  type SyncResultaat,
} from "@/lib/windsor/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * De Windsor-sync: advertentie-, post- en accountdata naar Postgres.
 *
 * ## Waarom in drie stukken
 *
 * Eén run over alles heen past niet binnen de vijf minuten die een serverless functie
 * krijgt: Facebook organic deed er in de meting alleen al 131 seconden over. Daarom drie
 * onderdelen die los draaien, elk ruim binnen de limiet, elk met een eigen cron-regel in
 * `vercel.json`:
 *
 *   ?deel=advertenties  — Meta, Google en LinkedIn Ads (±60 s)
 *   ?deel=organisch     — posts van Facebook, Instagram en LinkedIn (±120 s)
 *   ?deel=account       — pagina- en volgercijfers (±65 s)
 *
 * Zonder `deel` draait alles achter elkaar; handig om met de hand aan te roepen, maar
 * alleen verstandig met een ruimere timeout dan Vercel geeft.
 *
 * ## Waarom de volgorde uitmaakt
 *
 * `organisch` koppelt aan het eind de posts aan de advertenties die erop stonden. Die
 * koppeling leest de advertentietabel, dus `advertenties` hoort eerder op de avond te
 * draaien dan `organisch` — vandaar de tijden in vercel.json.
 */

type Deel = "advertenties" | "organisch" | "account";

function isGeautoriseerd(request: Request): boolean {
  const geheim = process.env.CRON_SECRET;
  if (!geheim) return false;
  return request.headers.get("authorization") === `Bearer ${geheim}`;
}

/**
 * Laat één onderdeel falen zonder de rest mee te slepen.
 *
 * Als Instagram vannacht plat ligt, is dat geen reden om ook de Google-cijfers niet bij
 * te werken. De fout komt wél terug in het antwoord én in `sync_runs`, zodat een stille
 * mislukking niet wekenlang onopgemerkt blijft.
 */
async function probeer(
  taak: () => Promise<SyncResultaat>,
  naam: string,
): Promise<SyncResultaat> {
  try {
    return await taak();
  } catch (err) {
    return {
      onderdeel: naam,
      gelezen: 0,
      geschreven: 0,
      duurMs: 0,
      fout: err instanceof Error ? err.message : String(err),
    };
  }
}

async function draai(
  client: Client,
  deel: Deel | null,
  van: string,
  tot: string,
): Promise<SyncResultaat[]> {
  const resultaten: SyncResultaat[] = [];
  const alles = deel === null;

  if (alles || deel === "advertenties") {
    // De maatwerkconversies eerst: welke velden er te halen zijn, bepaalt wat de
    // advertentie-opvragingen meenemen.
    let metaVelden: string[] = [];
    let googleVelden: string[] = [];
    try {
      const { velden, nieuw } = await syncConversieActies(client);
      metaVelden = velden.facebook;
      googleVelden = velden.google_ads;
      resultaten.push({
        onderdeel: "conversie-acties",
        gelezen: metaVelden.length + googleVelden.length,
        geschreven: nieuw,
        duurMs: 0,
      });
    } catch (err) {
      // Zonder catalogus halen we de vaste statistieken op en laten we de
      // maatwerkconversies deze nacht leeg — beter dan helemaal geen advertentiedata.
      resultaten.push({
        onderdeel: "conversie-acties",
        gelezen: 0,
        geschreven: 0,
        duurMs: 0,
        fout: err instanceof Error ? err.message : String(err),
      });
    }

    resultaten.push(await probeer(() => syncMetaAds(client, van, tot, metaVelden), "meta-ads"));
    resultaten.push(
      await probeer(() => syncGoogleAds(client, van, tot, googleVelden), "google-ads"),
    );
    resultaten.push(await probeer(() => syncLinkedInAds(client, van, tot), "linkedin-ads"));
  }

  if (alles || deel === "organisch") {
    resultaten.push(await probeer(() => syncFacebookPosts(client, van, tot), "facebook-posts"));
    resultaten.push(await probeer(() => syncInstagramPosts(client, van, tot), "instagram-posts"));
    resultaten.push(await probeer(() => syncLinkedInPosts(client, van, tot), "linkedin-posts"));
    resultaten.push(
      await probeer(() => koppelPostsAanAdvertenties(client), "post-advertentie-koppeling"),
    );
  }

  if (alles || deel === "account") {
    resultaten.push(await probeer(() => syncFacebookPagina(client, van, tot), "facebook-pagina"));
    resultaten.push(await probeer(() => syncLinkedInPagina(client, van, tot), "linkedin-pagina"));
    resultaten.push(
      await probeer(() => syncInstagramAccount(client, van, tot), "instagram-account"),
    );
    resultaten.push(await probeer(() => telPostsPerDag(client, van), "posts-per-dag"));
  }

  return resultaten;
}

export async function POST(request: Request) {
  if (!isGeautoriseerd(request)) {
    return NextResponse.json({ fout: "Niet geautoriseerd." }, { status: 401 });
  }
  if (!isWindsorGeconfigureerd()) {
    return NextResponse.json({ fout: "WINDSOR_API_KEY ontbreekt." }, { status: 503 });
  }

  const connectionString = process.env.SYNC_DATABASE_URL;
  if (!connectionString) {
    return NextResponse.json({ fout: "SYNC_DATABASE_URL ontbreekt." }, { status: 503 });
  }

  const url = new URL(request.url);
  const deelParam = url.searchParams.get("deel");
  const deel =
    deelParam === "advertenties" || deelParam === "organisch" || deelParam === "account"
      ? deelParam
      : null;

  // Een langere periode is met de hand op te geven om historie op te halen; standaard
  // het voortschrijdende venster van dertig dagen. Meta weigert verder terug dan
  // 37 maanden, dus een `dagen` groter dan ongeveer 1100 levert een foutmelding op.
  const dagen = Number(url.searchParams.get("dagen")) || VENSTER_DAGEN;
  const { van, tot } = standaardVenster(dagen);

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  const runStart = Date.now();
  try {
    await client.connect();

    const runRes = await client.query<{ id: string }>(
      `insert into dataloket.sync_runs (bron) values ($1) returning id`,
      [`windsor${deel ? `-${deel}` : ""}`],
    );
    const runId = runRes.rows[0].id;

    const resultaten = await draai(client, deel, van, tot);

    const gelezen = resultaten.reduce((t, r) => t + r.gelezen, 0);
    const geschreven = resultaten.reduce((t, r) => t + r.geschreven, 0);
    const fouten = resultaten.filter((r) => r.fout);

    await client.query(
      `update dataloket.sync_runs
          set geeindigd_op = now(), rijen_gelezen = $2, rijen_geplaatst = $3,
              gelukt = $4, fout = $5
        where id = $1`,
      [
        runId,
        gelezen,
        geschreven,
        fouten.length === 0,
        fouten.length === 0
          ? null
          : fouten.map((f) => `${f.onderdeel}: ${f.fout}`).join(" | "),
      ],
    );

    return NextResponse.json({
      status: fouten.length === 0 ? "klaar" : "klaar met fouten",
      periode: { van, tot },
      duurMs: Date.now() - runStart,
      resultaten,
    });
  } catch (err) {
    return NextResponse.json(
      { fout: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  } finally {
    await client.end().catch(() => {});
  }
}

/** Vercel Cron doet een GET; dezelfde autorisatie, dezelfde afhandeling. */
export async function GET(request: Request) {
  return POST(request);
}
