import { NextResponse } from "next/server";
import {
  haalAccounts,
  haalAdvertenties,
  haalKoppelingen,
  haalLaatsteSync,
  haalPosts,
  isKanalenGeconfigureerd,
} from "@/lib/kanalen/bron";
import { getGebruiker } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * De data achter de vijf Kanalen-pagina's.
 *
 * Eén route voor alle vijf, omdat ze hetzelfde patroon volgen: kies een pagina en een
 * periode, krijg de kubus terug. De pagina filtert daarna zelf in het geheugen — dat is
 * waarom hier geen filterparameters staan. Zou het filteren hier gebeuren, dan kostte
 * elke klik op een filter een netwerkronde, en precies dat moest het niet worden.
 *
 * De data verandert maar één keer per nacht, dus het antwoord mag ruim gecachet worden.
 * `stale-while-revalidate` zorgt dat de eerste bezoeker na de sync de oude versie krijgt
 * en de verse op de achtergrond wordt opgehaald, in plaats van te moeten wachten.
 */

const PAGINAS = ["social", "google", "organisch", "account", "koppeltabel"] as const;
type Pagina = (typeof PAGINAS)[number];

const CACHE = "private, max-age=300, stale-while-revalidate=3600";

function datumOf(waarde: string | null, terugval: Date): string {
  if (waarde && /^\d{4}-\d{2}-\d{2}$/.test(waarde)) return waarde;
  return terugval.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  // Kanaaldata is bedrijfsdata: wie niet is ingelogd, krijgt hem niet. Hetzelfde
  // uitgangspunt als bij de aantekeningen en het kostentabblad.
  const gebruiker = await getGebruiker();
  if (!gebruiker) {
    return NextResponse.json({ fout: "Niet ingelogd." }, { status: 401 });
  }

  if (!isKanalenGeconfigureerd()) {
    return NextResponse.json(
      { fout: "DATAQUERY_DATABASE_URL ontbreekt — de kanaaldata is niet aangesloten." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const paginaParam = url.searchParams.get("pagina");
  const pagina = (PAGINAS as readonly string[]).includes(paginaParam ?? "")
    ? (paginaParam as Pagina)
    : "social";

  const vandaag = new Date();
  const dertigTerug = new Date(vandaag);
  dertigTerug.setUTCDate(dertigTerug.getUTCDate() - 29);

  const van = datumOf(url.searchParams.get("van"), dertigTerug);
  const tot = datumOf(url.searchParams.get("tot"), vandaag);

  try {
    const laatsteSync = await haalLaatsteSync().catch(() => null);

    if (pagina === "koppeltabel") {
      const koppelingen = await haalKoppelingen();
      return NextResponse.json(
        { pagina, koppelingen, laatsteSync },
        { headers: { "Cache-Control": CACHE } },
      );
    }

    if (pagina === "organisch") {
      const data = await haalPosts(van, tot);
      return NextResponse.json({ pagina, ...data, laatsteSync }, { headers: { "Cache-Control": CACHE } });
    }

    if (pagina === "account") {
      const data = await haalAccounts(van, tot);
      return NextResponse.json({ pagina, ...data, laatsteSync }, { headers: { "Cache-Control": CACHE } });
    }

    const data = await haalAdvertenties(pagina === "google" ? "google" : "social", van, tot);
    return NextResponse.json({ pagina, ...data, laatsteSync }, { headers: { "Cache-Control": CACHE } });
  } catch (err) {
    return NextResponse.json(
      { fout: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
