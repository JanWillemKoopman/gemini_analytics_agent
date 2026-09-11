import { NextResponse } from "next/server";
import { getGebruiker } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isWachtwoordEigenaar } from "@/lib/gebruikersbeheer";

export const dynamic = "force-dynamic";

// Wijzigt het gedeelde standaardwachtwoord voor nieuw aan te maken collega-accounts.
// Alleen koopman.janwillem@gmail.com mag dit — server-side gecontroleerd op het
// ingelogde account, niet op iets dat de client meestuurt. De waarde wordt nergens
// teruggegeven, ook niet aan de eigenaar zelf: dit endpoint bevestigt alleen dat het
// is opgeslagen.
export async function POST(request: Request) {
  const gebruiker = await getGebruiker();
  if (!gebruiker || !isWachtwoordEigenaar(gebruiker.email)) {
    return NextResponse.json({ fout: "Geen toegang." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { wachtwoord?: unknown } | null;
  const wachtwoord = body?.wachtwoord;
  if (typeof wachtwoord !== "string" || wachtwoord.length < 8) {
    return NextResponse.json({ fout: "Wachtwoord moet minimaal 8 tekens zijn." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .schema("dataloket")
      .from("instellingen")
      .upsert({
        sleutel: "gebruikers_standaard_wachtwoord",
        waarde: wachtwoord,
        bijgewerkt_op: new Date().toISOString(),
        bijgewerkt_door: gebruiker.id,
      });
    if (error) return NextResponse.json({ fout: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { fout: err instanceof Error ? err.message : "Kon wachtwoord niet opslaan." },
      { status: 500 },
    );
  }
}
