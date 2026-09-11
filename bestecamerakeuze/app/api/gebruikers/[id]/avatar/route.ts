import { NextResponse } from "next/server";
import { getGebruiker } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isBeheerder } from "@/lib/gebruikersbeheer";
import { wijzigProfielAlsBeheerder } from "@/lib/profielen";

export const dynamic = "force-dynamic";

const MAX_BESTANDSGROOTTE = 4 * 1024 * 1024; // 4 MB — zelfde grens als het eigen profiel

/**
 * Foto uploaden namens een collega — alleen voor de twee beheeraccounts. Bij het eigen
 * profiel (components/instellingen/Instellingen.tsx) uploadt de browser rechtstreeks
 * naar Supabase Storage met de eigen sessie (RLS beperkt dat tot de eigen map); een
 * beheerder heeft geen sessie van de collega, dus loopt dit via de service-role-client
 * hier, die de storage-RLS omzeilt.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gebruiker = await getGebruiker();
  if (!gebruiker) return NextResponse.json({ fout: "Log eerst in." }, { status: 401 });
  if (!isBeheerder(gebruiker.email)) {
    return NextResponse.json({ fout: "Geen toegang." }, { status: 403 });
  }

  const { id } = await params;

  const formData = await request.formData().catch(() => null);
  const bestand = formData?.get("bestand");
  if (!(bestand instanceof File)) {
    return NextResponse.json({ fout: "Geen bestand ontvangen." }, { status: 400 });
  }
  if (!bestand.type.startsWith("image/")) {
    return NextResponse.json({ fout: "Kies een afbeelding (JPG, PNG of WebP)." }, { status: 400 });
  }
  if (bestand.size > MAX_BESTANDSGROOTTE) {
    return NextResponse.json({ fout: "De afbeelding mag maximaal 4 MB zijn." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const extensie = bestand.name.split(".").pop()?.toLowerCase() || "jpg";
    const pad = `${id}/avatar.${extensie}`;

    const { error: uploadFout } = await admin.storage
      .from("avatars")
      .upload(pad, await bestand.arrayBuffer(), {
        upsert: true,
        cacheControl: "3600",
        contentType: bestand.type,
      });
    if (uploadFout) return NextResponse.json({ fout: uploadFout.message }, { status: 400 });

    const {
      data: { publicUrl },
    } = admin.storage.from("avatars").getPublicUrl(pad);
    // Cache-buster, anders blijft de browser de oude foto tonen — de bestandsnaam zelf
    // verandert niet bij upsert.
    const avatarUrl = `${publicUrl}?t=${Date.now()}`;

    const profiel = await wijzigProfielAlsBeheerder(admin, id, { avatarUrl });
    return NextResponse.json({ profiel });
  } catch (err) {
    return NextResponse.json(
      { fout: err instanceof Error ? err.message : "Kon foto niet uploaden." },
      { status: 500 },
    );
  }
}
