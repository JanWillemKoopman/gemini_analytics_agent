import type { AlgemeneContext, TabelBeschrijving } from "@/lib/dictionary/types";
import { verkopen } from "@/lib/dictionary/tabellen/verkopen";
import { googleAdsCampagnes } from "@/lib/dictionary/tabellen/googleAdsCampagnes";
import { googleAdsZoekwoorden } from "@/lib/dictionary/tabellen/googleAdsZoekwoorden";
import { googleAdsAdvertentiegroepen } from "@/lib/dictionary/tabellen/googleAdsAdvertentiegroepen";
import { googleAdsConversies } from "@/lib/dictionary/tabellen/googleAdsConversies";

/**
 * Het complete datawoordenboek plus de vertaling ervan naar de systeemprompt.
 *
 * Een nieuwe bron toevoegen (Google Ads, Analytics, Selligent) is: een bestand in
 * `tabellen/` schrijven en hem hieronder in de lijst zetten. Aan de chat verandert dan
 * niets — het model ontdekt de tabel doordat hij in deze tekst verschijnt.
 */

export const algemeneContext: AlgemeneContext = {
  organisatie:
    "Udenhout — bedrijfswagendealer. De data beschrijft verkoop van voertuigen en " +
    "de marketingcampagnes daaromheen.",
  kalender: [
    "Weeknummers volgen de ISO-standaard: een week loopt van maandag tot en met zondag.",
    "Het boekjaar is gelijk aan het kalenderjaar.",
    "Kwartalen zijn kalenderkwartalen (Q1 = januari t/m maart).",
  ],
  conventies: [
    "Alle bedragen zijn in euro's.",
    "Bedragen zijn exclusief btw, tenzij bij een kolom anders vermeld.",
    "Datums staan in de tijdzone Europe/Amsterdam.",
  ],
};

/** Alle tabellen waar de chat op mag queryen. Nieuwe bron? Hier toevoegen. */
export const tabellen: TabelBeschrijving[] = [
  verkopen,
  googleAdsCampagnes,
  googleAdsZoekwoorden,
  googleAdsAdvertentiegroepen,
  googleAdsConversies,
];

/** De views waar de chat vanaf weet — gebruikt in de systeemprompt en in de UI. */
export function beschikbareViews(): string[] {
  return tabellen.map((t) => t.view);
}

function rendorKolom(k: TabelBeschrijving["kolommen"][number]): string {
  const delen = [`  - ${k.naam} (${k.type}): ${k.betekenis}`];
  if (k.eenheid) delen.push(`    eenheid: ${k.eenheid}`);
  if (k.waarden) delen.push(`    toegestane waarden: ${k.waarden.join(", ")}`);
  if (k.leegBetekent) delen.push(`    leeg betekent: ${k.leegBetekent}`);
  return delen.join("\n");
}

function renderTabel(t: TabelBeschrijving): string {
  const blokken: string[] = [];
  blokken.push(`## ${t.view}`);
  blokken.push(t.doel);
  blokken.push(`Granulariteit: ${t.granulariteit}`);
  blokken.push(`Bron: ${t.bron}. Ververst: ${t.ververst}.`);
  if (t.eigenaar) blokken.push(`Inhoudelijk eigenaar: ${t.eigenaar}.`);

  blokken.push(`\nKolommen:\n${t.kolommen.map(rendorKolom).join("\n")}`);

  blokken.push(
    `\nBedrijfsregels (deze gaan vóór je eigen aannames):\n` +
      t.regels.map((r) => `  - ${r}`).join("\n"),
  );

  if (t.synoniemen && Object.keys(t.synoniemen).length > 0) {
    blokken.push(
      `\nWoorden die collega's gebruiken:\n` +
        Object.entries(t.synoniemen)
          .map(([woord, betekent]) => `  - "${woord}" → ${betekent}`)
          .join("\n"),
    );
  }

  if (t.valkuilen && t.valkuilen.length > 0) {
    blokken.push(`\nValkuilen:\n${t.valkuilen.map((v) => `  - ${v}`).join("\n")}`);
  }

  if (t.koppelingen && t.koppelingen.length > 0) {
    blokken.push(
      `\nKoppelingen naar andere tabellen:\n` +
        t.koppelingen
          .map(
            (k) =>
              `  - ${k.naarTabel} via ${k.via}${k.toelichting ? ` — ${k.toelichting}` : ""}`,
          )
          .join("\n"),
    );
  }

  blokken.push(
    `\nVoorbeeldvragen met de juiste query:\n` +
      t.voorbeelden
        .map(
          (v) =>
            `  Vraag: ${v.vraag}\n  SQL:\n${v.sql
              .split("\n")
              .map((r) => `    ${r}`)
              .join("\n")}${v.toelichting ? `\n  Let op: ${v.toelichting}` : ""}`,
        )
        .join("\n\n"),
  );

  return blokken.join("\n");
}

/**
 * Het woordenboek als één tekstblok voor de systeemprompt.
 *
 * Dit blok is bewust stabiel: het verandert alleen als iemand het woordenboek aanpast.
 * Daardoor kan het gecachet worden (zie de cache_control in de chatroute), waarmee elke
 * vervolgvraag nog ongeveer een tiende kost van de eerste.
 */
export function woordenboekVoorPrompt(): string {
  return [
    "# Over deze organisatie",
    algemeneContext.organisatie,
    "",
    "## Kalender",
    algemeneContext.kalender.map((r) => `- ${r}`).join("\n"),
    "",
    "## Algemene conventies",
    algemeneContext.conventies.map((r) => `- ${r}`).join("\n"),
    "",
    "# Beschikbare tabellen",
    "",
    tabellen.map(renderTabel).join("\n\n---\n\n"),
  ].join("\n");
}
