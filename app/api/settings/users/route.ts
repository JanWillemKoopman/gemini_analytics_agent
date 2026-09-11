import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { withJsonErrors } from "@/lib/apiRoute";
import { FALLBACK_DEFAULT_PASSWORD, isLockedEmail } from "@/lib/settings/accounts";

// Instellingen → collega's: elke ingelogde gebruiker mag hier de ledenlijst zien en
// nieuwe collega's toevoegen — geen builder-check zoals bij /api/jobs. Het wachtwoord
// zelf komt nooit in een response terecht (zie lib/settings/accounts.ts).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function currentDefaultPassword(admin: ReturnType<typeof createAdminClient>): Promise<string> {
  const { data } = await admin
    .schema("mmm")
    .from("app_settings")
    .select("value")
    .eq("key", "bulk_default_password")
    .maybeSingle();
  return data?.value || FALLBACK_DEFAULT_PASSWORD;
}

async function handleGet() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });

  const admin = createAdminClient();
  // Supabase Auth heeft geen "alle gebruikers"-view op de eigen tabel — we lezen ze via de
  // admin-API en tellen erop dat de lijst klein genoeg blijft voor één pagina (collega's,
  // geen klanten). listUsers pagineert desnoods zelf verder als dit ooit meer wordt.
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const users = data.users
    .map((u) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      locked: isLockedEmail(u.email),
    }))
    .filter((u) => u.email)
    .sort((a, b) => a.email.localeCompare(b.email));

  return NextResponse.json({ users });
}

async function handlePost(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "niet ingelogd" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const rawEmails: unknown = body?.emails;
  if (!Array.isArray(rawEmails) || rawEmails.length === 0) {
    return NextResponse.json({ error: "geef minimaal één e-mailadres op" }, { status: 400 });
  }

  const emails = Array.from(
    new Set(
      rawEmails
        .filter((e): e is string => typeof e === "string")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
  const invalid = emails.filter((e) => !EMAIL_RE.test(e));
  if (invalid.length > 0) {
    return NextResponse.json({ error: `ongeldig e-mailadres: ${invalid.join(", ")}` }, { status: 400 });
  }

  const admin = createAdminClient();
  const password = await currentDefaultPassword(admin);

  const created: string[] = [];
  const skipped: string[] = [];
  const failed: { email: string; error: string }[] = [];

  for (const email of emails) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // meteen bruikbaar, geen bevestigingsmail nodig
    });
    if (error) {
      if (/already been registered|already exists/i.test(error.message)) {
        skipped.push(email);
      } else {
        failed.push({ email, error: error.message });
      }
      continue;
    }
    created.push(email);

    // mmm.app_users volgt de nieuwe auth-user; geen trigger hiervoor in de database, dus
    // expliciet aanmaken. is_builder blijft op de default (false) — deze pagina deelt
    // alleen inlogtoegang uit, geen bouwersrechten.
    await admin.schema("mmm").from("app_users").upsert({ id: data.user.id, email });
  }

  return NextResponse.json({ created, skipped, failed });
}

export const GET = withJsonErrors(handleGet);
export const POST = withJsonErrors(handlePost);
