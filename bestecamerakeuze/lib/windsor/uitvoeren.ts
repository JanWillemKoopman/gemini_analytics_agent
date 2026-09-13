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

/**
 * Het uitvoeren van één deel van de Windsor-sync, los van wie hem start.
 *
 * Twee aanroepers delen deze code: de nachtelijke cron (`/api/windsor-sync`, met
 * `CRON_SECRET`) en de knop "Data ophalen" in het dashboard (`/api/kanalen/ophalen`,
 * met de sessie van de ingelogde collega). Dat verschil zit alleen in wie er mag
 * starten; wat er daarna gebeurt hoort identiek te zijn, anders levert de knop stilletjes
 * andere cijfers op dan de nacht.
 */

export const DELEN = ["advertenties", "organisch", "account"] as const;
export type Deel = (typeof DELEN)[number];

export function isDeel(waarde: unknown): waarde is Deel {
  return typeof waarde === "string" && (DELEN as readonly string[]).includes(waarde);
}

export interface SyncUitkomst {
  ok: boolean;
  deel: Deel | "alles";
  periode: { van: string; tot: string };
  duurMs: number;
  resultaten: SyncResultaat[];
  fout?: string;
}

/**
 * Laat één onderdeel falen zonder de rest mee te slepen.
 *
 * Ligt Instagram er vannacht uit, dan is dat geen reden om ook de Google-cijfers niet
 * bij te werken. De fout komt wél terug in het antwoord én in `sync_runs`, zodat een
 * stille mislukking niet wekenlang onopgemerkt blijft.
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
      // maatwerkconversies deze ronde leeg — beter dan helemaal geen advertentiedata.
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

/**
 * Draait de sync en schrijft er een regel over in `sync_runs`.
 *
 * Gooit alleen als er helemaal niets kon beginnen (geen sleutel, geen verbinding). Gaat
 * er onderweg iets mis, dan komt dat als `fout` bij het betreffende onderdeel terug en
 * blijft de rest gewoon staan.
 */
export async function voerSyncUit(
  deel: Deel | null,
  dagen: number = VENSTER_DAGEN,
): Promise<SyncUitkomst> {
  if (!isWindsorGeconfigureerd()) {
    throw new Error("WINDSOR_API_KEY ontbreekt.");
  }
  const connectionString = process.env.SYNC_DATABASE_URL;
  if (!connectionString) {
    throw new Error("SYNC_DATABASE_URL ontbreekt.");
  }

  const { van, tot } = standaardVenster(dagen);
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  const start = Date.now();

  await client.connect();
  try {
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
        fouten.length === 0 ? null : fouten.map((f) => `${f.onderdeel}: ${f.fout}`).join(" | "),
      ],
    );

    return {
      ok: fouten.length === 0,
      deel: deel ?? "alles",
      periode: { van, tot },
      duurMs: Date.now() - start,
      resultaten,
    };
  } finally {
    await client.end().catch(() => {});
  }
}
