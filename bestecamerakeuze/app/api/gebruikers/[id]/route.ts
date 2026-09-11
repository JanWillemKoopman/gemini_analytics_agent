import { NextResponse } from "next/server";
import { getGebruiker } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isVergrendeldeEmail } from "@/lib/gebruikersbeheer";

export const dynamic = "force-dynamic";

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
