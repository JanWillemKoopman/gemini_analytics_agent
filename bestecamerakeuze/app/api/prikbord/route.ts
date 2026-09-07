import { NextResponse } from "next/server";
import { getGebruiker } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { lijstPrikbord, pinVast } from "@/lib/prikbord";
import { haalProfielen } from "@/lib/profielen";
import type { Weergave } from "@/components/chat/Visual";

export const dynamic = "force-dynamic";

const MAX_TITEL = 200;
/** Meer rijen dan dit hoort niet op een bord thuis; dat is een download, geen overzicht. */
const MAX_RIJEN = 200;

export async function GET() {
  const gebruiker = await getGebruiker();
  if (!gebruiker) return NextResponse.json({ fout: "Log eerst in." }, { status: 401 });

  try {
    const supabase = await createClient();
    const items = await lijstPrikbord(supabase);
    const profielen = await haalProfielen(
      supabase,
      items.map((i) => i.aangemaaktDoor),
    );
    return NextResponse.json({ items, profielen });
  } catch (err) {
    return NextResponse.json(
      { fout: err instanceof Error ? err.message : "Kon het prikbord niet ophalen." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const gebruiker = await getGebruiker();
  if (!gebruiker) return NextResponse.json({ fout: "Log eerst in." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const sql = typeof body.sql === "string" ? body.sql.trim() : "";
  const weergave = body.weergave as Weergave | undefined;
  const titel = (typeof body.titel === "string" ? body.titel.trim() : "") || weergave?.titel || "";
  const vraag = typeof body.vraag === "string" ? body.vraag.trim() || null : null;
  const kolommen = Array.isArray(body.kolommen) ? (body.kolommen as string[]) : [];
  const rijen = Array.isArray(body.rijen)
    ? (body.rijen as Record<string, unknown>[]).slice(0, MAX_RIJEN)
    : [];

  if (!sql || !weergave || !titel) {
    return NextResponse.json({ fout: "Titel, query en weergave zijn verplicht." }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const item = await pinVast(supabase, gebruiker.id, {
      titel: titel.slice(0, MAX_TITEL),
      vraag,
      sql,
      weergave,
      kolommen,
      rijen,
    });
    return NextResponse.json({ item });
  } catch (err) {
    return NextResponse.json(
      { fout: err instanceof Error ? err.message : "Kon niet vastpinnen." },
      { status: 500 },
    );
  }
}
