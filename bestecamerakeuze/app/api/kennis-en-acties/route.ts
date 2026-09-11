import { NextResponse } from "next/server";
import { getGebruiker } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { lijstAlleNotities } from "@/lib/campagneNotities";
import { haalAlleProfielen } from "@/lib/profielen";

export const dynamic = "force-dynamic";

/**
 * De tabbladen "Scores" en "Kennis en acties" in één keer: alle aantekeningen over alle
 * campagnes heen, plus álle profielen. Beide tabbladen delen deze ene ophaalactie via
 * `TeamDataProvider` (lib/teamData.tsx).
 *
 * Waarom alle profielen en niet alleen de schrijvers: het scorebord zet iedere collega
 * op de rij, ook wie deze maand nog niets heeft vastgelegd — dat lege plekje is de
 * bedoeling.
 *
 * Toevoegen gebeurt via de bestaande POST op /api/campagne-notities; het is dezelfde
 * tabel en dezelfde validatie, dus daar hoort geen tweede schrijfroute naast.
 */
export async function GET() {
  const gebruiker = await getGebruiker();
  if (!gebruiker) return NextResponse.json({ fout: "Log eerst in." }, { status: 401 });

  try {
    const supabase = await createClient();
    const [items, profielen] = await Promise.all([
      lijstAlleNotities(supabase),
      haalAlleProfielen(supabase),
    ]);
    return NextResponse.json({ items, profielen });
  } catch (err) {
    return NextResponse.json(
      { fout: err instanceof Error ? err.message : "Kon de berichten niet ophalen." },
      { status: 500 },
    );
  }
}
