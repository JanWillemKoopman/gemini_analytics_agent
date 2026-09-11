import { NextResponse } from "next/server";
import { getGebruiker } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isBeheerder, isVergrendeldeEmail } from "@/lib/gebruikersbeheer";
import { wijzigProfielAlsBeheerder } from "@/lib/profielen";
import { zetWachtwoord } from "@/lib/wachtwoorden";

export const dynamic = "force-dynamic";

const MAX_NAAM_LENGTE = 100;
const MIN_WACHTWOORD_LENGTE = 6; // zelfde ondergrens als Supabase Auth zelf hanteert

// Instellingen → Gebruikers: alleen de twee beheeraccounts (isBeheerder) mogen hier
// naam, foto en wachtwoord van een willekeurige collega wijzigen — server-side
// afgedwongen, niet alleen verstopt in de UI. Geldt ook voor de vergrendelde accounts
// zelf: "vergrendeld" gaat alleen over niet-verwijderbaar, niet over niet-bewerkbaar.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gebruiker = await getGebruiker();
  if (!gebruiker) return NextResponse.json({ fout: "Log eerst in." }, { status: 401 });
  if (!isBeheerder(gebruiker.email)) {
    return NextResponse.json({ fout: "Geen toegang." }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    const admin = createAdminClient();

    if (typeof body.naam === "string" || body.avatarUrl === null || typeof body.avatarUrl === "string") {
      const invoer: Parameters<typeof wijzigProfielAlsBeheerder>[2] = {};
      if (typeof body.naam === "string") {
        const naam = body.naam.trim();
        if (naam.length > MAX_NAAM_LENGTE) {
          return NextResponse.json({ fout: "Naam is te lang." }, { status: 400 });
        }
        invoer.naam = naam || null;
      }
      if (body.avatarUrl === null || typeof body.avatarUrl === "string") {
        invoer.avatarUrl = body.avatarUrl;
      }
      await wijzigProfielAlsBeheerder(admin, id, invoer);
    }

    if (typeof body.wachtwoord === "string" && body.wachtwoord.length > 0) {
      if (body.wachtwoord.length < MIN_WACHTWOORD_LENGTE) {
        return NextResponse.json(
          { fout: `Wachtwoord moet minimaal ${MIN_WACHTWOORD_LENGTE} tekens zijn.` },
          { status: 400 },
        );
      }
      const { error } = await admin.auth.admin.updateUserById(id, { password: body.wachtwoord });
      if (error) return NextResponse.json({ fout: error.message }, { status: 400 });
      await zetWachtwoord(admin, id, body.wachtwoord);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { fout: err instanceof Error ? err.message : "Kon gebruiker niet wijzigen." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gebruiker = await getGebruiker();
  if (!gebruiker) return NextResponse.json({ fout: "Log eerst in." }, { status: 401 });

  const { id } = await params;

  try {
    const admin = createAdminClient();
    const { data, error: opzoekFout } = await admin.auth.admin.getUserById(id);
    if (opzoekFout || !data?.user) {
      return NextResponse.json({ fout: "Gebruiker niet gevonden." }, { status: 404 });
    }

    // Server-side afgedwongen, niet alleen een verborgen knop: deze twee accounts
    // kunnen nooit verwijderd worden, door wie dan ook, ook niet via een directe
    // API-aanroep.
    if (isVergrendeldeEmail(data.user.email)) {
      return NextResponse.json(
        { fout: "Dit account is vergrendeld en kan niet verwijderd worden." },
        { status: 403 },
      );
    }

    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return NextResponse.json({ fout: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { fout: err instanceof Error ? err.message : "Kon gebruiker niet verwijderen." },
      { status: 500 },
    );
  }
}
