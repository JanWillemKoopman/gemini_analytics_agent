import { NextResponse } from "next/server";
import { getGebruiker } from "@/lib/auth";
import {
  isSheetsSchrijvenGeconfigureerd,
  voegCampagneToe,
  type NieuweCampagneVelden,
} from "@/lib/sheetSchrijven";

export const dynamic = "force-dynamic";

const MAX_VELDLENGTE = 200;

/** Dezelfde velden als het whitelist-formulier in het dashboard, min "naam" (apart verplicht). */
const OVERIGE_VELDEN: (keyof Omit<NieuweCampagneVelden, "naam">)[] = [
  "budget",
  "uitgaven",
  "doelLeads",
  "doelOrders",
  "startdatum",
  "einddatum",
  "merk",
  "model",
  "leadType",
  "ordersoort",
  "klantgroepOrders",
];

export async function POST(request: Request) {
  const gebruiker = await getGebruiker();
  if (!gebruiker) return NextResponse.json({ fout: "Log eerst in." }, { status: 401 });

  if (!isSheetsSchrijvenGeconfigureerd()) {
    return NextResponse.json({ fout: "Schrijven naar de sheet is niet geconfigureerd." }, { status: 501 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const naam = typeof body.naam === "string" ? body.naam.trim() : "";
  if (!naam) {
    return NextResponse.json({ fout: "Campagnenaam is verplicht." }, { status: 400 });
  }
  if (naam.length > MAX_VELDLENGTE) {
    return NextResponse.json({ fout: "Campagnenaam is te lang." }, { status: 400 });
  }

  const velden: NieuweCampagneVelden = { naam };
  for (const veld of OVERIGE_VELDEN) {
    const ruw = body[veld];
    if (typeof ruw !== "string") continue;
    const waarde = ruw.trim();
    if (!waarde) continue;
    if (waarde.length > MAX_VELDLENGTE) {
      return NextResponse.json({ fout: `Veld "${veld}" is te lang.` }, { status: 400 });
    }
    velden[veld] = waarde;
  }

  try {
    await voegCampagneToe(velden);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { fout: err instanceof Error ? err.message : "Kon de campagne niet opslaan." },
      { status: 400 },
    );
  }
}
