import { NextResponse } from "next/server";
import { getGebruiker } from "@/lib/auth";
import { isSchrijfbaarVeld, isSheetsSchrijvenGeconfigureerd, schrijfVeld } from "@/lib/sheetSchrijven";

export const dynamic = "force-dynamic";

const MAX_WAARDE_LENGTE = 200;

export async function POST(request: Request) {
  const gebruiker = await getGebruiker();
  if (!gebruiker) return NextResponse.json({ fout: "Log eerst in." }, { status: 401 });

  if (!isSheetsSchrijvenGeconfigureerd()) {
    return NextResponse.json({ fout: "Schrijven naar de sheet is niet geconfigureerd." }, { status: 501 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const campagne = typeof body.campagne === "string" ? body.campagne.trim() : "";
  const veld = typeof body.veld === "string" ? body.veld : "";
  const waarde = typeof body.waarde === "string" ? body.waarde.trim() : "";

  if (!campagne || !veld) {
    return NextResponse.json({ fout: "Campagne en veld zijn verplicht." }, { status: 400 });
  }
  // Whitelist-check ook hier, niet alleen client-side: het endpoint mag nooit een veld
  // schrijven dat niet expliciet is vrijgegeven, ongeacht wat de client meestuurt.
  if (!isSchrijfbaarVeld(veld)) {
    return NextResponse.json({ fout: "Dit veld mag niet aangepast worden." }, { status: 403 });
  }
  if (waarde.length > MAX_WAARDE_LENGTE) {
    return NextResponse.json({ fout: "Waarde is te lang." }, { status: 400 });
  }

  try {
    await schrijfVeld(campagne, veld, waarde);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { fout: err instanceof Error ? err.message : "Kon niet opslaan." },
      { status: 400 },
    );
  }
}
