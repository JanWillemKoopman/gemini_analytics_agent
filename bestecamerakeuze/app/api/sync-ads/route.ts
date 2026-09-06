import { NextResponse } from "next/server";
import { Client } from "pg";
import {
  heeftAdsConfig,
  haalCampagnes,
  haalZoekwoorden,
  haalAdvertentiegroepen,
  haalConversies,
} from "@/lib/sync/googleAds";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * De Ads-sync-job: Google Ads API → Postgres.
 *
 * Los van /api/sync (dat sheets kopieert) omdat de bron en de auth compleet anders zijn:
 * OAuth met een developer token in plaats van een publieke CSV-export. De bookkeeping
 * (sync_runs, dezelfde schrijvende verbinding) is bewust wel identiek.
 *
 * Draait via Vercel Cron (zie vercel.json) en is ook handmatig aan te roepen.
 */

function isGeautoriseerd(request: Request): boolean {
  const geheim = process.env.CRON_SECRET;
  if (!geheim) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${geheim}`;
}

interface SyncResultaat {
  bron: string;
  geplaatst: number;
}

async function verversTabel<T extends object>(
  client: Client,
  bronNaam: string,
  doeltabel: string,
  rijen: T[],
): Promise<SyncResultaat> {
  const startRes = await client.query<{ id: string }>(
    `insert into dataloket.sync_runs (bron) values ($1) returning id`,
    [bronNaam],
  );
  const runId = startRes.rows[0].id;

  try {
    // Volledige verversing in één transactie, zelfde reden als bij de sheet-sync: bij
    // duizenden rijen simpeler en betrouwbaarder dan bijhouden wat er veranderd is.
    await client.query("begin");
    await client.query(`truncate table dataloket.${doeltabel}`);

    if (rijen.length > 0) {
      const kolommen = Object.keys(rijen[0]);
      for (const rij of rijen) {
        const rijAlsRecord = rij as Record<string, unknown>;
        const waarden = kolommen.map((k) => rijAlsRecord[k] ?? null);
        const plaatshouders = waarden.map((_, i) => `$${i + 1}`).join(", ");
        await client.query(
          `insert into dataloket.${doeltabel} (${kolommen.join(", ")}) values (${plaatshouders})`,
          waarden,
        );
      }
    }
    await client.query("commit");

    await client.query(
      `update dataloket.sync_runs
          set geeindigd_op = now(), rijen_gelezen = $2, rijen_geplaatst = $2,
              rijen_afgekeurd = 0, gelukt = true
        where id = $1`,
      [runId, rijen.length],
    );

    return { bron: bronNaam, geplaatst: rijen.length };
  } catch (err) {
    await client.query("rollback").catch(() => {});
    const bericht = err instanceof Error ? err.message : String(err);
    await client.query(
      `update dataloket.sync_runs set geeindigd_op = now(), gelukt = false, fout = $2 where id = $1`,
      [runId, bericht],
    );
    throw err;
  }
}

export async function POST(request: Request) {
  if (!isGeautoriseerd(request)) {
    return NextResponse.json({ fout: "Niet geautoriseerd." }, { status: 401 });
  }

  const connectionString = process.env.SYNC_DATABASE_URL;
  if (!connectionString) {
    return NextResponse.json({ fout: "SYNC_DATABASE_URL ontbreekt." }, { status: 503 });
  }

  if (!heeftAdsConfig()) {
    return NextResponse.json({
      status: "niets te doen",
      toelichting:
        "Google Ads is nog niet geconfigureerd — zie README-dataloket.md, sectie " +
        "'Google Ads API koppelen', voor de benodigde omgevingsvariabelen.",
    });
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const resultaten: SyncResultaat[] = [
      await verversTabel(
        client,
        "google_ads_campagnes",
        "ads_campagnes_raw",
        await haalCampagnes(),
      ),
      await verversTabel(
        client,
        "google_ads_zoekwoorden",
        "ads_zoekwoorden_raw",
        await haalZoekwoorden(),
      ),
      await verversTabel(
        client,
        "google_ads_advertentiegroepen",
        "ads_advertentiegroepen_raw",
        await haalAdvertentiegroepen(),
      ),
      await verversTabel(
        client,
        "google_ads_conversies",
        "ads_conversies_raw",
        await haalConversies(),
      ),
    ];
    return NextResponse.json({ status: "klaar", resultaten });
  } catch (err) {
    const bericht = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ fout: bericht }, { status: 500 });
  } finally {
    await client.end().catch(() => {});
  }
}

/** Vercel Cron doet een GET; dezelfde autorisatie, dezelfde afhandeling. */
export async function GET(request: Request) {
  return POST(request);
}
