import { NextResponse } from "next/server";
import { getGebruiker } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Het opslaan van één regel uit de koppeltabel: campagne → campagnemanager, merk,
 * categorie en de bijbehorende campagne in de sheet.
 *
 * Schrijft via de Supabase-client en niet via de Postgres-verbinding van de rest van de
 * kanaaldata. Reden: deze tabel is het enige stuk kanaaldata dat mensen zelf invullen,
 * en hij heeft daarom RLS met policies — dan hoort de schrijfactie ook door die policies
 * heen te gaan, met de sessie van de collega die het invulde. `bijgewerkt_door` maakt
 * achteraf herleidbaar wie wat koppelde.
 */

const MAX_LENGTE = 200;

function schoon(waarde: unknown): string | null {
  if (typeof waarde !== "string") return null;
  const kaal = waarde.trim();
  if (!kaal) return null;
  return kaal.slice(0, MAX_LENGTE);
}

export async function POST(request: Request) {
  const gebruiker = await getGebruiker();
  if (!gebruiker) return NextResponse.json({ fout: "Log eerst in." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const campagne = schoon(body.campagne);
  if (!campagne) {
    return NextResponse.json({ fout: "Campagnenaam ontbreekt." }, { status: 400 });
  }

  const regel = {
    campagne,
    bron: schoon(body.bron),
    eigenaar_naam: schoon(body.eigenaarNaam),
    merk: schoon(body.merk),
    categorie: schoon(body.categorie),
    sheet_campagne: schoon(body.sheetCampagne),
    notitie: schoon(body.notitie),
    bijgewerkt_door: gebruiker.id,
  };

  try {
    const supabase = await createClient();
    const tabel = supabase.schema("dataloket").from("windsor_campagne_eigenaar");

    // Bewust geen upsert: die stuurt één INSERT … ON CONFLICT DO UPDATE en zet dus ook
    // `aangemaakt_door` opnieuw, waardoor de collega die de koppeling ooit aanlegde bij
    // elke wijziging uit beeld verdwijnt. Eerst bijwerken, en alleen invoegen als er nog
    // niets stond, houdt dat spoor intact.
    const { data: bijgewerkt, error: updateFout } = await tabel
      .update(regel)
      .eq("campagne", campagne)
      .select("campagne");

    if (updateFout) throw new Error(updateFout.message);

    if (!bijgewerkt || bijgewerkt.length === 0) {
      const { error: insertFout } = await tabel.insert({
        ...regel,
        aangemaakt_door: gebruiker.id,
      });
      if (insertFout) throw new Error(insertFout.message);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { fout: err instanceof Error ? err.message : "Opslaan mislukt." },
      { status: 500 },
    );
  }
}
