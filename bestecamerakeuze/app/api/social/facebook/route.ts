import { NextResponse } from "next/server";
import { getGebruiker } from "@/lib/auth";
import { isWindsorGeconfigureerd } from "@/lib/config";
import { haalFacebookOverzicht } from "@/lib/windsor";

export const dynamic = "force-dynamic";
// Twee Windsor-aanroepen achter elkaar over een lange periode duren makkelijk een halve
// minuut; de standaard van 10 seconden kapt dat af.
export const maxDuration = 60;

const GELDIGE_DATUM = /^\d{4}-\d{2}-\d{2}$/;

/** Grens op de periode: bij méér dagen wordt de Windsor-aanroep traag en de grafiek onleesbaar. */
const MAX_DAGEN = 180;

function vandaag(): string {
  return new Date().toISOString().slice(0, 10);
}

function dagenGeleden(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * De Facebook-cijfers van Windsor.ai, opgeteld per dag, per campagne en per pagina.
 *
 * Achter de inlog: de API-sleutel van Windsor staat in de omgeving van de server en mag
 * de browser nooit bereiken, dus het ophalen gebeurt hier en niet in het paneel zelf.
 */
export async function GET(request: Request) {
  const gebruiker = await getGebruiker();
  if (!gebruiker) return NextResponse.json({ fout: "Log eerst in." }, { status: 401 });

  if (!isWindsorGeconfigureerd()) {
    return NextResponse.json(
      { fout: "WINDSOR_API_KEY ontbreekt in de omgeving — zie .env.example." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const vanParam = url.searchParams.get("van");
  const totParam = url.searchParams.get("tot");
  let van = vanParam && GELDIGE_DATUM.test(vanParam) ? vanParam : dagenGeleden(29);
  let tot = totParam && GELDIGE_DATUM.test(totParam) ? totParam : vandaag();
  if (van > tot) [van, tot] = [tot, van];
  if (tot > vandaag()) tot = vandaag();
  const vroegste = dagenGeleden(MAX_DAGEN - 1);
  if (van < vroegste) van = vroegste;

  try {
    const overzicht = await haalFacebookOverzicht(van, tot);
    return NextResponse.json(overzicht);
  } catch (err) {
    return NextResponse.json(
      {
        fout:
          err instanceof Error ? err.message : "Kon de Facebook-cijfers niet ophalen.",
      },
      { status: 502 },
    );
  }
}
