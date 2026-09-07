import { NextResponse } from "next/server";
import { getGebruiker } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { voerQueryUit } from "@/lib/dataQuery";
import { bewaarVerversing, haalPrikbordItem, verwijderPrikbordItem } from "@/lib/prikbord";

export const dynamic = "force-dynamic";

/** In Next 15 zijn routeparameters async. */
type Ctx = { params: Promise<{ id: string }> };

const MAX_RIJEN = 200;

/**
 * Verversen: dezelfde query nog een keer draaien.
 *
 * De SQL komt uit de database, maar dat maakt hem niet vertrouwd — hij gaat door
 * precies dezelfde drie grenzen als een query uit de chat (guard, read-only rol,
 * read-only transactie met timeout). Zie lib/dataQuery.ts.
 */
export async function PATCH(_request: Request, { params }: Ctx) {
  const gebruiker = await getGebruiker();
  if (!gebruiker) return NextResponse.json({ fout: "Log eerst in." }, { status: 401 });

  const { id } = await params;
  try {
    const supabase = await createClient();
    const item = await haalPrikbordItem(supabase, id);
    if (!item) return NextResponse.json({ fout: "Niet gevonden." }, { status: 404 });

    const uitkomst = await voerQueryUit(item.sql);
    if (!uitkomst.ok) return NextResponse.json({ fout: uitkomst.fout }, { status: 400 });

    const bijgewerkt = await bewaarVerversing(
      supabase,
      id,
      uitkomst.resultaat.kolommen,
      uitkomst.resultaat.rijen.slice(0, MAX_RIJEN),
    );
    return NextResponse.json({ item: bijgewerkt });
  } catch (err) {
    return NextResponse.json(
      { fout: err instanceof Error ? err.message : "Kon niet verversen." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const gebruiker = await getGebruiker();
  if (!gebruiker) return NextResponse.json({ fout: "Log eerst in." }, { status: 401 });

  const { id } = await params;
  try {
    const supabase = await createClient();
    await verwijderPrikbordItem(supabase, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { fout: err instanceof Error ? err.message : "Kon niet verwijderen." },
      { status: 500 },
    );
  }
}
