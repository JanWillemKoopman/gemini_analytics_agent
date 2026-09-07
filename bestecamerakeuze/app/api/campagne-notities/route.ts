import { NextResponse } from "next/server";
import { getGebruiker } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { lijstNotities, maakNotitie } from "@/lib/campagneNotities";
import { isNotitieSoort, vindMetriek, vraagtOmMetriek } from "@/lib/notities";
import { haalProfiel, haalProfielen } from "@/lib/profielen";

export const dynamic = "force-dynamic";

const MAX_TEKST_LENGTE = 1000;

export async function GET(request: Request) {
  const gebruiker = await getGebruiker();
  if (!gebruiker) return NextResponse.json({ fout: "Log eerst in." }, { status: 401 });

  const campagne = new URL(request.url).searchParams.get("campagne")?.trim();
  if (!campagne) return NextResponse.json({ fout: "Campagnenaam ontbreekt." }, { status: 400 });

  try {
    const supabase = await createClient();
    const items = await lijstNotities(supabase, campagne);
    // Eén keer alle betrokken profielen ophalen (naam + avatar) i.p.v. per aantekening —
    // zodat je in de pop-up meteen ziet wie welke aantekening heeft toegevoegd.
    const profielen = await haalProfielen(
      supabase,
      items.map((i) => i.aangemaaktDoor),
    );
    return NextResponse.json({ items, profielen });
  } catch (err) {
    return NextResponse.json(
      { fout: err instanceof Error ? err.message : "Kon aantekeningen niet ophalen." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const gebruiker = await getGebruiker();
  if (!gebruiker) return NextResponse.json({ fout: "Log eerst in." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const campagne = typeof body.campagne === "string" ? body.campagne.trim() : "";
  const tekst = typeof body.tekst === "string" ? body.tekst.trim() : "";
  const soort = isNotitieSoort(body.soort) ? body.soort : "observatie";
  // Een metriek die niet in de lijst staat wordt genegeerd in plaats van geweigerd: de
  // aantekening zelf is waardevoller dan de koppeling eraan.
  const metriek = vraagtOmMetriek(soort)
    ? (vindMetriek(typeof body.metriek === "string" ? body.metriek : null)?.key ?? null)
    : null;
  const metriekWaarde =
    metriek && typeof body.metriekWaarde === "number" && Number.isFinite(body.metriekWaarde)
      ? body.metriekWaarde
      : null;

  if (!campagne || !tekst) {
    return NextResponse.json({ fout: "Campagne en tekst zijn verplicht." }, { status: 400 });
  }
  if (tekst.length > MAX_TEKST_LENGTE) {
    return NextResponse.json({ fout: "Aantekening is te lang." }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const item = await maakNotitie(supabase, gebruiker.id, {
      campagneNaam: campagne,
      tekst,
      soort,
      metriek,
      metriekWaarde,
    });
    const profiel = await haalProfiel(supabase, gebruiker.id);
    return NextResponse.json({ item, profiel });
  } catch (err) {
    return NextResponse.json(
      { fout: err instanceof Error ? err.message : "Kon aantekening niet opslaan." },
      { status: 500 },
    );
  }
}
