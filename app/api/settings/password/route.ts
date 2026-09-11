import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { withJsonErrors } from "@/lib/apiRoute";
import { isPasswordOwner } from "@/lib/settings/accounts";

// Wijzigt het gedeelde standaardwachtwoord dat nieuwe collega-accounts krijgen. Alleen
// koopman.janwillem@gmail.com mag dit — server-side gecontroleerd op het ingelogde
// account, niet op iets dat de client meestuurt. De waarde wordt nergens teruggegeven,
// ook niet aan de eigenaar zelf: dit endpoint bevestigt alleen dat het is opgeslagen.
async function handlePost(request: Request) {
  const viewer = await getViewer();
  if (!viewer || !isPasswordOwner(viewer.email)) {
    return NextResponse.json({ error: "geen toegang" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const password: unknown = body?.password;
  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "wachtwoord moet minimaal 8 tekens zijn" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .schema("mmm")
    .from("app_settings")
    .upsert({ key: "bulk_default_password", value: password, updated_at: new Date().toISOString(), updated_by: viewer.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

export const POST = withJsonErrors(handlePost);
