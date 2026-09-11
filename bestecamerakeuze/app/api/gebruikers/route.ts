import { NextResponse } from "next/server";
import { getGebruiker } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { STANDAARD_WACHTWOORD_FALLBACK, isVergrendeldeEmail } from "@/lib/gebruikersbeheer";

export const dynamic = "force-dynamic";

// Instellingen → Gebruikers: elke ingelogde collega mag hier de ledenlijst zien en
// nieuwe collega's toevoegen. Het wachtwoord zelf komt nooit in een response terecht
// (zie lib/gebruikersbeheer.ts).

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function huidigStandaardWachtwoord(admin: ReturnType<typeof createAdminClient>): Promise<string> {
  const { data } = await admin
    .schema("dataloket")
    .from("instellingen")
    .select("waarde")
    .eq("sleutel", "gebruikers_standaard_wachtwoord")
    .maybeSingle();
  return data?.waarde || STANDAARD_WACHTWOORD_FALLBACK;
}

export async function GET() {
  const gebruiker = await getGebruiker();
  if (!gebruiker) return NextResponse.json({ fout: "Log eerst in." }, { status: 401 });

  try {
    const admin = createAdminClient();
    // Supabase Auth heeft geen view op de eigen tabel — via de admin-API lezen; de
    // lijst blijft klein genoeg (collega's, geen klanten) voor één pagina.
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (error) return NextResponse.json({ fout: error.message }, { status: 400 });

    const gebruikers = data.users
      .filter((u) => u.email)
      .map((u) => ({
        id: u.id,
        email: u.email as string,
        aangemaaktOp: u.created_at,
        vergrendeld: isVergrendeldeEmail(u.email),
      }))
      .sort((a, b) => a.email.localeCompare(b.email));

    return NextResponse.json({ gebruikers });
  } catch (err) {
    return NextResponse.json(
      { fout: err instanceof Error ? err.message : "Kon gebruikers niet ophalen." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const gebruiker = await getGebruiker();
  if (!gebruiker) return NextResponse.json({ fout: "Log eerst in." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { emails?: unknown } | null;
  const ruweEmails = body?.emails;
  if (!Array.isArray(ruweEmails) || ruweEmails.length === 0) {
    return NextResponse.json({ fout: "Geef minimaal één e-mailadres op." }, { status: 400 });
  }

  const emails = Array.from(
    new Set(
      ruweEmails
        .filter((e): e is string => typeof e === "string")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
  const ongeldig = emails.filter((e) => !EMAIL_REGEX.test(e));
  if (ongeldig.length > 0) {
    return NextResponse.json({ fout: `Ongeldig e-mailadres: ${ongeldig.join(", ")}` }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const wachtwoord = await huidigStandaardWachtwoord(admin);

    const aangemaakt: string[] = [];
    const overgeslagen: string[] = [];
    const mislukt: { email: string; fout: string }[] = [];

    for (const email of emails) {
      const { error } = await admin.auth.admin.createUser({
        email,
        password: wachtwoord,
        email_confirm: true, // meteen bruikbaar, geen bevestigingsmail nodig
      });
      if (error) {
        if (/already been registered|already exists/i.test(error.message)) {
          overgeslagen.push(email);
        } else {
          mislukt.push({ email, fout: error.message });
        }
        continue;
      }
      // dataloket.profielen wordt automatisch aangemaakt door de trigger op
      // auth.users (0006_profielen.sql), dus hier verder niets te doen.
      aangemaakt.push(email);
    }

    return NextResponse.json({ aangemaakt, overgeslagen, mislukt });
  } catch (err) {
    return NextResponse.json(
      { fout: err instanceof Error ? err.message : "Kon gebruikers niet aanmaken." },
      { status: 500 },
    );
  }
}
