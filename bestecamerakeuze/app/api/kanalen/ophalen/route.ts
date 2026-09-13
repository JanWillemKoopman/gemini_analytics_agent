import { NextResponse } from "next/server";
import { getGebruiker } from "@/lib/auth";
import { isWindsorGeconfigureerd } from "@/lib/windsor/api";
import { isDeel, voerSyncUit } from "@/lib/windsor/uitvoeren";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * "Data ophalen" vanuit het dashboard zelf.
 *
 * Dezelfde sync als de nachtelijke cron (`/api/windsor-sync`), maar gestart door een
 * ingelogde collega in plaats van door Vercel. Bestaat omdat de cron-route zich
 * beschermt met `CRON_SECRET`, en dat geheim hoort niet in een browser thuis: wie alleen
 * in de browser werkt zou anders een terminal nodig hebben om de eerste vulling te
 * starten of om na een mislukte nacht bij te trekken.
 *
 * Toegang is simpelweg "ingelogd", net als bij de aantekeningen en het kostentabblad —
 * dit is een leesactie bij Windsor en een schrijfactie naar de eigen tabellen, geen
 * onomkeerbare ingreep. Twee keer draaien is onschadelijk: alles gaat via een upsert op
 * dezelfde sleutel, dus een dubbele run overschrijft in plaats van te verdubbelen.
 *
 * Eén deel per aanroep. De browser houdt de verbinding open zolang de sync loopt, en
 * drie delen achter elkaar in één request zou langer duren dan de vijf minuten die een
 * functie krijgt. De UI roept ze daarom na elkaar aan en laat per deel zien hoe het ging.
 */

export async function POST(request: Request) {
  const gebruiker = await getGebruiker();
  if (!gebruiker) {
    return NextResponse.json({ fout: "Log eerst in." }, { status: 401 });
  }
  if (!isWindsorGeconfigureerd()) {
    return NextResponse.json(
      { fout: "WINDSOR_API_KEY ontbreekt — de koppeling met Windsor.ai is nog niet ingesteld." },
      { status: 503 },
    );
  }
  if (!process.env.SYNC_DATABASE_URL) {
    return NextResponse.json(
      { fout: "SYNC_DATABASE_URL ontbreekt — er is geen schrijvende databaseverbinding." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (!isDeel(body.deel)) {
    return NextResponse.json(
      { fout: "Onbekend onderdeel. Kies advertenties, organisch of account." },
      { status: 400 },
    );
  }

  // Begrensd tot ruim binnen Meta's venster van 37 maanden; daarbuiten weigert het
  // platform de hele opvraging in plaats van alleen het oudste stuk.
  const dagen = Math.min(Math.max(Number(body.dagen) || 30, 1), 1000);

  try {
    const uitkomst = await voerSyncUit(body.deel, dagen);
    return NextResponse.json(uitkomst);
  } catch (err) {
    return NextResponse.json(
      { fout: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
