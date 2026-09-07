import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getGebruiker } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { chatGereedheid } from "@/lib/config";
import { woordenboekVoorPrompt, beschikbareViews } from "@/lib/dictionary";
import { resultaatVoorModel, voerQueryUit } from "@/lib/dataQuery";
import { logQuery } from "@/lib/queryLog";
import { logClaudeGebruik } from "@/lib/kosten";
import {
  bewaarBericht,
  haalBerichten,
  hernoemGesprek,
  verwijderLaatsteBeurt,
} from "@/lib/gesprekken";
import { KLEIN_MODEL, maakNabewerking } from "@/lib/vervolg";
import { kennisVoorPrompt, lijstKennis } from "@/lib/kennisbank";
import type { Vorm, Weergave } from "@/components/chat/Visual";
import type { Eenheid } from "@/components/chat/chartTheme";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Hoeveel queries het model maximaal mag draaien voor één vraag. */
const MAX_RONDES = 6;

/**
 * Het model waarop de chat draait.
 *
 * Staat tijdens de testfase bewust op Haiku 4.5 in plaats van Opus 5: vijf keer
 * goedkoper per token ($1/$5 per miljoen tegen $5/$25), wat scheelt zolang er vooral
 * geoefend wordt in plaats van gewerkt. Haiku is minder sterk in het schrijven van SQL
 * over een groot woordenboek; daarvoor is ESCALATIE_MODEL hieronder het vangnet — elke
 * vraag begint goedkoop en stapt pas over als dat aantoonbaar niet volstaat.
 *
 * Zie je in het Kosten-tabblad dat vrijwel elke beurt escaleert, dan kost die eerste
 * goedkope poging alleen maar geld: zet CHAT_MODEL dan op het sterkere model. Dat kan
 * zonder deploy; de kostenregistratie kent alle drie de modellen (lib/kosten.ts).
 *
 * Let op: Haiku 4.5 heeft een contextvenster van 200K in plaats van 1M. Het woordenboek
 * plus de kennisbank passen daar ruim in, maar een kennisbank die eindeloos groeit loopt
 * hier eerder tegen een grens aan (PROMPT_BUDGET in lib/kennisbank.ts bewaakt dat).
 */
const MODEL = process.env.CHAT_MODEL || "claude-haiku-4-5";

/**
 * Het model waarop wordt overgestapt zodra Haiku het niet redt.
 *
 * Sonnet 5 kost $2/$10 per miljoen tokens: tweeënhalf keer Haiku, maar nog altijd
 * tweeënhalf keer goedkoper dan Opus 5 — en het schrijft merkbaar betrouwbaarder SQL
 * over een groot woordenboek. De goedkope beurt is dan al betaald, maar dat is een paar
 * cent tegenover een antwoord dat wél klopt.
 *
 * Er wordt op drie momenten overgestapt (zie de lus hieronder):
 *  - een query van Haiku loopt vast op een databasefout;
 *  - de aanroep zelf mislukt (bv. het model geeft ongeldige toolinvoer terug);
 *  - de gebruiker klikt op "opnieuw beantwoorden" — dan was het eerste antwoord blijkbaar
 *    niet goed genoeg, dus die beurt begint meteen op het sterkere model.
 */
const ESCALATIE_MODEL = process.env.CHAT_MODEL_ESCALATIE || "claude-sonnet-5";

const QUERY_TOOL: Anthropic.Tool = {
  name: "query_data",
  description:
    "Voer een read-only SQL-query uit op de marketing- en verkoopdata. Gebruik " +
    "uitsluitend de views uit het datawoordenboek. Eén SELECT per aanroep. Je mag " +
    "meerdere keren queryen: eerst verkennen (welke waarden bestaan er?) en daarna " +
    "pas het echte antwoord ophalen. Krijg je een foutmelding terug, lees hem en " +
    "probeer een gecorrigeerde query.",
  input_schema: {
    type: "object",
    properties: {
      sql: {
        type: "string",
        description: "Precies één SELECT-statement, zonder afsluitende puntkomma.",
      },
      toelichting: {
        type: "string",
        description:
          "Eén zin: wat wil je met deze query te weten komen? Wordt aan de gebruiker getoond.",
      },
      vorm: {
        type: "string",
        enum: ["verberg", "kpi", "staaf", "lijn", "donut", "tabel"],
        description:
          "Hoe dit resultaat aan de gebruiker getoond wordt. Gebruik 'verberg' voor " +
          "verkennende queries die de gebruiker niet hoeft te zien. Zie de regels in de " +
          "systeeminstructie voor de keuze.",
      },
      titel: {
        type: "string",
        description:
          "Korte titel boven de weergave, bijvoorbeeld 'Verkochte voertuigen per merk, " +
          "Q3 2025'. Leeg laten bij vorm 'verberg'.",
      },
      label_kolom: {
        type: "string",
        description:
          "Kolom met de categorie of de tijdseenheid (de x-as). Leeg laten bij 'verberg' " +
          "of 'tabel'.",
      },
      waarde_kolom: {
        type: "string",
        description:
          "Kolom met het getal dat getekend wordt. Leeg laten bij 'verberg' of 'tabel'.",
      },
      eenheid: {
        type: "string",
        enum: ["geen", "euro", "aantal", "procent"],
        description: "Eenheid van waarde_kolom, voor de opmaak van de getallen.",
      },
    },
    required: [
      "sql",
      "toelichting",
      "vorm",
      "titel",
      "label_kolom",
      "waarde_kolom",
      "eenheid",
    ],
    additionalProperties: false,
  },
  strict: true,
};

function systeemInstructie(): string {
  return [
    "Je bent de data-assistent van Udenhout. Collega's van marketing en verkoop stellen",
    "je vragen over hun eigen data; jij beantwoordt die door SQL te schrijven en uit te",
    "voeren met het gereedschap query_data.",
    "",
    "Werkwijze:",
    "- Beantwoord elke vraag met echte cijfers uit een query. Reken nooit zelf en schat nooit.",
    "- Twijfel je over een waarde (spelling van een merk, welke statussen voorkomen)? Draai",
    "  eerst een kleine verkennende query en daarna pas de echte.",
    "- Volg altijd de bedrijfsregels uit het woordenboek hieronder. Die gaan vóór je eigen aannames.",
    "- Krijg je een foutmelding, herstel de query dan zelf en probeer het opnieuw.",
    "",
    "Kies bij elke query een weergave (het veld `vorm`):",
    "- verberg — verkennende query; de gebruiker hoeft dit niet te zien.",
    "- kpi — precies één getal. Een enkel getal is geen grafiek: toon het groot.",
    "  Nooit een staafdiagram met één staaf.",
    "- staaf — categorieën met elkaar vergelijken (per merk, per campagne, per verkoper).",
    "  Werkt tot ongeveer vijftien categorieën.",
    "- lijn — een verloop over tijd (per week, per maand, per kwartaal). Alleen als de",
    "  x-as echt tijd is; anders is het een staaf.",
    "- donut — deel-van-het-geheel, hoogstens zes segmenten, en alleen als de verhoudingen",
    "  duidelijk verschillen. Liggen ze dicht bij elkaar, kies dan staaf: in een donut zijn",
    "  vergelijkbare partjes niet uit elkaar te houden.",
    "- tabel — meerdere kolommen die er allemaal toe doen, of een opsomming van regels.",
    "",
    "Antwoorden — je antwoord bestaat uit drie delen, in deze volgorde:",
    "1. Het directe antwoord in één zin, met het getal erin.",
    "2. De interpretatie: twee tot vier zinnen over wat er opvalt. Wat is het grootst of",
    "   kleinst, hoe verhouden de posten zich (aandeel, factor, verschil), gaat het omhoog",
    "   of omlaag, springt er iets uit? Benoem wat een collega zou moeten opvallen, niet",
    "   alleen wat er staat. Herhaal niet alle getallen die al in de grafiek staan.",
    "3. De aannames die je hebt toegepast: welke statussen meegeteld, welk datumbereik,",
    "   welke kolom je als verkoopdatum hebt gebruikt.",
    "",
    "Nog een paar regels voor de tekst:",
    "- Nederlands, gewone taal, geen jargon en geen SQL in je antwoord.",
    "- Wees voorzichtig met oorzaak en gevolg. Je ziet samenhang in de cijfers, geen",
    "  verklaring — schrijf 'valt samen met' en niet 'komt door', tenzij de data het",
    "  echt aantoont.",
    "- Vind je iets dat waarschijnlijk een datafout is (een dubbeling, een onmogelijke",
    "  datum, een uitschieter van orde van grootte), zeg dat er dan bij.",
    "- Kun je een vraag niet beantwoorden met de beschikbare tabellen, zeg dat dan en leg uit",
    "  welke gegevens ervoor nodig zouden zijn. Verzin nooit een antwoord.",
    "",
    `Beschikbare views: ${beschikbareViews().join(", ")}. Andere tabellen bestaan niet voor jou.`,
  ].join("\n");
}

/** Wat er per uitgevoerde query naar de UI gaat: de weergave plus de verantwoording. */
interface QueryVerslag {
  sql: string;
  toelichting: string;
  aantalRijen: number | null;
  duurMs: number | null;
  fout: string | null;
  kolommen: string[];
  rijen: Record<string, unknown>[];
  weergave: Weergave;
}

const GELDIGE_VORMEN: Vorm[] = ["verberg", "kpi", "staaf", "lijn", "donut", "tabel"];
const GELDIGE_EENHEDEN: Eenheid[] = ["geen", "euro", "aantal", "procent"];

/** Leest de weergavevelden uit de toolaanroep, met veilige waarden als er iets mist. */
function leesWeergave(invoer: Record<string, unknown>): Weergave {
  const vorm = invoer.vorm;
  const eenheid = invoer.eenheid;
  return {
    vorm:
      typeof vorm === "string" && (GELDIGE_VORMEN as string[]).includes(vorm)
        ? (vorm as Vorm)
        : "tabel",
    titel: typeof invoer.titel === "string" ? invoer.titel : "",
    labelKolom: typeof invoer.label_kolom === "string" ? invoer.label_kolom : "",
    waardeKolom: typeof invoer.waarde_kolom === "string" ? invoer.waarde_kolom : "",
    eenheid:
      typeof eenheid === "string" && (GELDIGE_EENHEDEN as string[]).includes(eenheid)
        ? (eenheid as Eenheid)
        : "geen",
  };
}

export async function POST(request: Request) {
  const gereed = chatGereedheid();
  if (!gereed.gereed) {
    return NextResponse.json(
      { fout: `Nog niet geconfigureerd: ${gereed.ontbreekt.join("; ")}` },
      { status: 503 },
    );
  }

  const gebruiker = await getGebruiker();
  if (!gebruiker) {
    return NextResponse.json({ fout: "Log eerst in." }, { status: 401 });
  }

  let body: { vraag?: unknown; gesprekId?: unknown; opnieuw?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ fout: "Ongeldig verzoek." }, { status: 400 });
  }

  const vraag = typeof body.vraag === "string" ? body.vraag.trim() : "";
  if (!vraag) {
    return NextResponse.json({ fout: "Geen vraag meegestuurd." }, { status: 400 });
  }
  if (vraag.length > 4000) {
    return NextResponse.json({ fout: "Vraag is te lang." }, { status: 400 });
  }

  const gesprekId = typeof body.gesprekId === "string" ? body.gesprekId : "";
  if (!gesprekId) {
    return NextResponse.json({ fout: "Geen gesprek meegestuurd." }, { status: 400 });
  }

  // Vóór de stream aanmaken: hierna is `cookies()` niet meer aan te roepen (zie queryLog.ts).
  const supabase = await createClient();

  // Bij "opnieuw proberen" verdwijnt de vorige beurt, anders staat de vraag straks
  // dubbel in de geschiedenis.
  const opnieuwProberen = body.opnieuw === true;
  if (opnieuwProberen) {
    await verwijderLaatsteBeurt(supabase, gesprekId);
  }

  // De geschiedenis komt uit de database, niet van de client. Dat is meteen de
  // afscherming: de rijbeveiliging bepaalt welke berichten hier terugkomen, dus het
  // meesturen van andermans gesprek levert niets op.
  const opgeslagen = await haalBerichten(supabase, gesprekId);
  const eersteBeurt = opgeslagen.length === 0;

  const messages: Anthropic.MessageParam[] = opgeslagen.slice(-20).map((b) => ({
    role: b.rol === "gebruiker" ? ("user" as const) : ("assistant" as const),
    content: b.tekst || "(leeg)",
  }));
  messages.push({ role: "user", content: vraag });

  const vraagBerichtId = await bewaarBericht(supabase, gesprekId, "gebruiker", vraag);

  // De kennisbank die collega's zelf onderhouden. Ophalen moet hier gebeuren: binnen de
  // stream is `cookies()` niet meer beschikbaar. Mislukt het ophalen, dan gaat de chat
  // gewoon door zonder deze context.
  const kennisTekst = await lijstKennis(supabase, true)
    .then((items) => kennisVoorPrompt(items).tekst)
    .catch(() => "");

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const encoder = new TextEncoder();
  let afgebroken = false;

  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      afgebroken = true;
    },
    async start(controller) {
      const send = (obj: unknown) => {
        if (afgebroken) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
        } catch {
          afgebroken = true;
        }
      };

      const verslagen: QueryVerslag[] = [];
      let antwoord = "";
      // Begint op het goedkope model; escaleert binnen dezelfde beurt zodra blijkt dat
      // dat niet volstaat. Een keer overgestapt blijft de rest van de beurt op het
      // sterkere model — heen en weer springen levert alleen maar cache-misses op.
      let actiefModel = opnieuwProberen ? ESCALATIE_MODEL : MODEL;
      if (actiefModel !== MODEL) send({ type: "model", model: actiefModel });

      const escaleer = (reden: string, herstart = false): boolean => {
        if (actiefModel === ESCALATIE_MODEL) return false;
        actiefModel = ESCALATIE_MODEL;
        send({ type: "model", model: actiefModel, reden, herstart });
        return true;
      };
      const escaleerMetHerstart = (reden: string) => escaleer(reden, true);

      try {
        for (let ronde = 0; ronde < MAX_RONDES; ronde++) {
          const runner = client.messages.stream({
            model: actiefModel,
            max_tokens: 8000,
            // Het woordenboek is een grote, stabiele prefix. Het cachebreekpunt staat er
            // achteraan, zodat elke vervolgvraag in hetzelfde gesprek de instructie plus
            // het woordenboek uit de cache leest in plaats van opnieuw te betalen.
            // Volgorde is hier functioneel: instructie en woordenboek zijn stabiel en
            // staan vóór het cachebreekpunt, de kennisbank erna. Marketeers passen die
            // kennisbank dagelijks aan; stond hij in het gecachete deel, dan zou elke
            // wijziging de cache van het hele woordenboek weggooien.
            system: [
              { type: "text", text: systeemInstructie() },
              {
                type: "text",
                text: woordenboekVoorPrompt(),
                cache_control: { type: "ephemeral" },
              },
              ...(kennisTekst
                ? [{ type: "text" as const, text: kennisTekst }]
                : []),
            ],
            tools: [QUERY_TOOL],
            messages,
          });

          runner.on("streamEvent", (event) => {
            if (event.type !== "content_block_start") return;
            const blok = event.content_block;
            if (blok.type === "thinking") send({ type: "fase", fase: "denken" });
            else if (blok.type === "text") send({ type: "fase", fase: "schrijven" });
            else if (blok.type === "tool_use") send({ type: "fase", fase: "query" });
          });
          runner.on("text", (delta) => send({ type: "tekst", tekst: delta }));

          let response: Anthropic.Message;
          try {
            response = await runner.finalMessage();
          } catch (err) {
            // Mislukt de aanroep zelf (ongeldige toolinvoer, een overbelast model), dan
            // is dat op het snelle model reden om over te stappen en de beurt opnieuw te
            // beginnen. `herstart` vertelt de browser dat hij het halve antwoord dat hij
            // misschien al binnen had moet weggooien. Lukt het op het sterkere model ook
            // niet, dan hoort de fout gewoon bij de gebruiker terecht te komen.
            if (!escaleerMetHerstart(err instanceof Error ? err.message : String(err))) throw err;
            continue;
          }

          await logClaudeGebruik(supabase, {
            model: actiefModel,
            doel: "chat",
            gebruikerId: gebruiker.id,
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            cacheSchrijfTokens: response.usage.cache_creation_input_tokens ?? 0,
            cacheLeesTokens: response.usage.cache_read_input_tokens ?? 0,
          });

          // Het volledige content-blok teruggeven, inclusief eventuele thinking-blokken:
          // die horen ongewijzigd terug bij hetzelfde model.
          messages.push({ role: "assistant", content: response.content });

          const tekstBlokken = response.content.filter(
            (b): b is Anthropic.TextBlock => b.type === "text",
          );
          if (tekstBlokken.length > 0) {
            antwoord = tekstBlokken.map((b) => b.text).join("\n\n").trim();
          }

          const toolAanroepen = response.content.filter(
            (b): b is Anthropic.ToolUseBlock =>
              b.type === "tool_use" && b.name === "query_data",
          );

          if (response.stop_reason !== "tool_use" || toolAanroepen.length === 0) {
            break;
          }

          // Alle tool_results horen in één user-bericht terug — apart versturen leert het
          // model af om nog parallelle aanroepen te doen.
          const resultaten: Anthropic.ToolResultBlockParam[] = [];

          for (const aanroep of toolAanroepen) {
            const invoer = aanroep.input as Record<string, unknown>;
            const sql = typeof invoer.sql === "string" ? invoer.sql : "";
            const toelichting =
              typeof invoer.toelichting === "string" ? invoer.toelichting : "";
            const weergave = leesWeergave(invoer);

            const uitkomst = await voerQueryUit(sql);

            if (uitkomst.ok) {
              const verslag: QueryVerslag = {
                sql,
                toelichting,
                aantalRijen: uitkomst.resultaat.aantalRijen,
                duurMs: uitkomst.resultaat.duurMs,
                fout: null,
                kolommen: uitkomst.resultaat.kolommen,
                rijen: uitkomst.resultaat.rijen.slice(0, 100),
                weergave,
              };
              verslagen.push(verslag);
              send({ type: "query", ...verslag });
              resultaten.push({
                type: "tool_result",
                tool_use_id: aanroep.id,
                content: resultaatVoorModel(uitkomst.resultaat),
              });
            } else {
              const verslag: QueryVerslag = {
                sql,
                toelichting,
                aantalRijen: null,
                duurMs: null,
                fout: uitkomst.fout,
                kolommen: [],
                rijen: [],
                weergave: { ...weergave, vorm: "verberg" },
              };
              verslagen.push(verslag);
              send({ type: "query", ...verslag });
              resultaten.push({
                type: "tool_result",
                tool_use_id: aanroep.id,
                content: `Fout: ${uitkomst.fout}`,
                is_error: true,
              });
            }

            // Vastleggen wat er gevraagd en gedraaid is. Dit log is later je beste bron
            // voor verbeteringen aan het woordenboek: vragen die misgingen staan erin.
            await logQuery(supabase, {
              gebruikerId: gebruiker.id,
              vraag,
              sql,
              toelichting,
              gelukt: uitkomst.ok,
              fout: uitkomst.ok ? null : uitkomst.fout,
              aantalRijen: uitkomst.ok ? uitkomst.resultaat.aantalRijen : null,
              duurMs: uitkomst.ok ? uitkomst.resultaat.duurMs : null,
            });
          }

          messages.push({ role: "user", content: resultaten });

          // Een query die stukloopt is het duidelijkste signaal dat het snelle model de
          // datastructuur niet goed genoeg doorheeft. De foutmelding staat al in de
          // geschiedenis; het sterkere model leest hem en herstelt de query zelf.
          if (resultaten.some((r) => r.is_error)) {
            escaleer("een query liep vast");
          }

          if (ronde === MAX_RONDES - 1) {
            antwoord =
              antwoord ||
              "Ik kwam er met het toegestane aantal queries niet uit. Stel de vraag " +
                "iets specifieker, dan lukt het meestal wel.";
          }
        }

        const eindAntwoord =
          antwoord ||
          "Ik heb hier geen antwoord op kunnen formuleren. Probeer de vraag anders te stellen.";

        const berichtId = await bewaarBericht(
          supabase,
          gesprekId,
          "assistent",
          eindAntwoord,
          verslagen,
        );

        // Titel en vervolgvragen zijn nuttig, maar nooit een reden om een antwoord te
        // laten mislukken — vandaar dat dit pas ná het opslaan gebeurt.
        const nabewerking = await maakNabewerking(client, vraag, eindAntwoord, eersteBeurt);
        if (nabewerking.titel) {
          await hernoemGesprek(supabase, gesprekId, nabewerking.titel).catch(() => {});
        }
        if (nabewerking.usage) {
          await logClaudeGebruik(supabase, {
            model: KLEIN_MODEL,
            doel: "nabewerking",
            gebruikerId: gebruiker.id,
            inputTokens: nabewerking.usage.input_tokens,
            outputTokens: nabewerking.usage.output_tokens,
            cacheSchrijfTokens: nabewerking.usage.cache_creation_input_tokens ?? 0,
            cacheLeesTokens: nabewerking.usage.cache_read_input_tokens ?? 0,
          });
        }

        send({
          type: "klaar",
          antwoord: eindAntwoord,
          queries: verslagen,
          berichtId,
          vraagBerichtId,
          titel: nabewerking.titel,
          vervolgvragen: nabewerking.vervolgvragen,
        });
      } catch (err) {
        const bericht = err instanceof Error ? err.message : String(err);
        send({ type: "fout", fout: bericht });
      } finally {
        try {
          controller.close();
        } catch {
          // Al gesloten of afgebroken.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
