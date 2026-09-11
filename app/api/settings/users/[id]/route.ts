import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { withJsonErrors } from "@/lib/apiRoute";
import { isLockedEmail } from "@/lib/settings/accounts";

async function handleDelete(_request: Request, { params }: { params: { id: string } }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error: lookupError } = await admin.auth.admin.getUserById(params.id);
  if (lookupError || !data?.user) {
    return NextResponse.json({ error: "gebruiker niet gevonden" }, { status: 404 });
  }

  // Server-side afgedwongen, niet alleen een verborgen knop: deze twee accounts kunnen
  // nooit verwijderd worden, door wie dan ook, ook niet via een directe API-aanroep.
  if (isLockedEmail(data.user.email)) {
    return NextResponse.json({ error: "dit account is vergrendeld en kan niet verwijderd worden" }, { status: 403 });
  }

  const { error } = await admin.auth.admin.deleteUser(params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

export const DELETE = withJsonErrors(handleDelete);
