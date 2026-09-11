import { NextResponse } from "next/server";
import { getGebruiker } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { haalProfiel, wijzigEigenProfiel } from "@/lib/profielen";
import { isThemeId } from "@/lib/themes";

export const dynamic = "force-dynamic";

const MAX_NAAM_LENGTE = 100;

export async function GET() {
  const gebruiker = await getGebruiker();
  if (!gebruiker) return NextResponse.json({ fout: "Log eerst in." }, { status: 401 });

  try {
    const supabase = await createClient();
    const profiel = await haalProfiel(supabase, gebruiker.id);
    return NextResponse.json({
      profiel: profiel ?? { id: gebruiker.id, naam: null, avatarUrl: null, theme: null },
    });
  } catch (err) {
    return NextResponse.json(
      { fout: err instanceof Error ? err.message : "Kon profiel niet ophalen." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const gebruiker = await getGebruiker();
  if (!gebruiker) return NextResponse.json({ fout: "Log eerst in." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const invoer: Parameters<typeof wijzigEigenProfiel>[2] = {};

  if (typeof body.naam === "string") {
    const naam = body.naam.trim();
    if (naam.length > MAX_NAAM_LENGTE) {
      return NextResponse.json({ fout: "Naam is te lang." }, { status: 400 });
    }
    invoer.naam = naam || null;
  }
  if (typeof body.avatarUrl === "string" || body.avatarUrl === null) {
    invoer.avatarUrl = body.avatarUrl;
  }
  if (body.theme !== undefined) {
    if (body.theme !== null && !isThemeId(body.theme)) {
      return NextResponse.json({ fout: "Onbekend theme." }, { status: 400 });
    }
    invoer.theme = body.theme;
  }

  try {
    const supabase = await createClient();
    const profiel = await wijzigEigenProfiel(supabase, gebruiker.id, invoer);
    return NextResponse.json({ profiel });
  } catch (err) {
    return NextResponse.json(
      { fout: err instanceof Error ? err.message : "Kon profiel niet opslaan." },
      { status: 500 },
    );
  }
}
