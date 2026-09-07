import { NextResponse } from "next/server";
import { getGebruiker } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { haalPopulaireVragen } from "@/lib/vraagbibliotheek";

export const dynamic = "force-dynamic";

export async function GET() {
  const gebruiker = await getGebruiker();
  if (!gebruiker) return NextResponse.json({ fout: "Log eerst in." }, { status: 401 });

  try {
    const supabase = await createClient();
    return NextResponse.json({ vragen: await haalPopulaireVragen(supabase) });
  } catch (err) {
    // Een lege bibliotheek is geen fout in de UI: de chat valt dan terug op de
    // voorbeeldvragen. Alleen echte fouten komen hier als fout terug.
    return NextResponse.json(
      { fout: err instanceof Error ? err.message : "Kon de vraagbibliotheek niet ophalen." },
      { status: 500 },
    );
  }
}
