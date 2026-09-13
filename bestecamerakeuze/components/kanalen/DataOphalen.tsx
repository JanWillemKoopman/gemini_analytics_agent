"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { IconCheck, IconClose, IconDownload, IconRefresh } from "@/components/icons";

/**
 * "Data ophalen": de nachtelijke Windsor-sync met de hand starten, vanuit de browser.
 *
 * Waarom dit bestaat: de cron beschermt zich met `CRON_SECRET`, en dat geheim hoort niet
 * in een browser. Zonder deze knop had je een terminal nodig om de eerste vulling te
 * starten of om bij te trekken na een nacht waarin er iets misging — en dat is precies
 * wat een marketeer niet heeft.
 *
 * De drie delen gaan ná elkaar, niet tegelijk. Twee redenen: één request per deel blijft
 * binnen de vijf minuten die een functie krijgt, en `organisch` koppelt aan het eind de
 * posts aan de advertenties, dus het moet ná `advertenties` draaien. Per stap zie je wat
 * er gebeurde; gaat er één mis, dan stopt de rij daar en blijft staan wat al gelukt is.
 */

type Stap = {
  deel: "advertenties" | "organisch" | "account";
  label: string;
  toelichting: string;
};

const STAPPEN: Stap[] = [
  {
    deel: "advertenties",
    label: "Advertenties",
    toelichting: "Meta, Google en LinkedIn Ads",
  },
  {
    deel: "organisch",
    label: "Organische posts",
    toelichting: "Facebook, Instagram en LinkedIn, plus de koppeling met de advertenties",
  },
  {
    deel: "account",
    label: "Accountcijfers",
    toelichting: "volgers, bereik en interactie per account",
  },
];

const PERIODES = [
  { dagen: 30, label: "30 dagen", hint: "de gewone nachtelijke ronde" },
  { dagen: 90, label: "90 dagen", hint: "aan te raden bij de eerste keer" },
  { dagen: 365, label: "12 maanden", hint: "kan per stap een paar minuten duren" },
];

type Stand =
  | { soort: "wacht" }
  | { soort: "bezig" }
  | { soort: "klaar"; gelezen: number; geschreven: number; seconden: number; waarschuwing?: string }
  | { soort: "fout"; bericht: string };

interface Onderdeel {
  onderdeel: string;
  gelezen: number;
  geschreven: number;
  fout?: string;
}

export default function DataOphalen({ onKlaar }: { onKlaar: () => void }) {
  const [open, setOpen] = useState(false);
  const [dagen, setDagen] = useState(90);
  const [bezig, setBezig] = useState(false);
  const [standen, setStanden] = useState<Record<string, Stand>>({});
  const [afgerond, setAfgerond] = useState(false);

  function zet(deel: string, stand: Stand) {
    setStanden((huidig) => ({ ...huidig, [deel]: stand }));
  }

  async function start() {
    setBezig(true);
    setAfgerond(false);
    setStanden(Object.fromEntries(STAPPEN.map((s) => [s.deel, { soort: "wacht" } as Stand])));

    for (const stap of STAPPEN) {
      zet(stap.deel, { soort: "bezig" });
      try {
        const res = await fetch("/api/kanalen/ophalen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deel: stap.deel, dagen }),
        });
        const data = (await res.json()) as {
          fout?: string;
          duurMs?: number;
          resultaten?: Onderdeel[];
        };

        if (!res.ok) throw new Error(data.fout ?? `Mislukt (${res.status}).`);

        const resultaten = data.resultaten ?? [];
        const gelezen = resultaten.reduce((t, r) => t + r.gelezen, 0);
        const geschreven = resultaten.reduce((t, r) => t + r.geschreven, 0);
        const fouten = resultaten.filter((r) => r.fout);

        zet(stap.deel, {
          soort: "klaar",
          gelezen,
          geschreven,
          seconden: Math.round((data.duurMs ?? 0) / 1000),
          // Eén platform dat eruit ligt is geen reden om de stap als mislukt te tonen,
          // maar het hoort ook niet als een schone ronde te voelen.
          waarschuwing:
            fouten.length > 0
              ? `${fouten.length === 1 ? "Eén onderdeel ging" : `${fouten.length} onderdelen gingen`} mis: ${fouten
                  .map((f) => `${f.onderdeel} — ${f.fout}`)
                  .join(" · ")}`
              : undefined,
        });
      } catch (err) {
        zet(stap.deel, {
          soort: "fout",
          bericht: err instanceof Error ? err.message : String(err),
        });
        setBezig(false);
        return; // de volgende stap leunt op deze; doorgaan levert halve cijfers op
      }
    }

    setBezig(false);
    setAfgerond(true);
    onKlaar();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex shrink-0 items-center gap-1.5 rounded-control px-2 py-1.5 text-sm font-medium text-ink-muted transition-colors duration-[var(--duur-snel)] hover:bg-surface hover:text-ink"
      >
        <IconDownload className="h-4 w-4" />
        Data ophalen
      </button>

      {open && (
        <Modal
          title="Data ophalen bij Windsor.ai"
          onClose={() => {
            // Tijdens het ophalen niet sluiten: de verzoeken lopen via deze pagina, en
            // wegklikken breekt de lopende stap af halverwege het wegschrijven.
            if (!bezig) setOpen(false);
          }}
        >
          <p className="text-sm text-ink-muted">
            Normaal gebeurt dit elke nacht vanzelf. Gebruik dit voor de eerste vulling, of
            als er een nacht is overgeslagen. Twee keer draaien kan geen kwaad — de cijfers
            worden overschreven, niet opgeteld.
          </p>

          <div className="mt-5">
            <p className="label-theme mb-2 text-label text-ink-faint">Hoeveel historie</p>
            <div className="flex flex-wrap gap-2">
              {PERIODES.map((p) => (
                <button
                  key={p.dagen}
                  type="button"
                  disabled={bezig}
                  onClick={() => setDagen(p.dagen)}
                  className={`rounded-control border px-3 py-2 text-left transition-colors duration-[var(--duur-snel)] disabled:opacity-50 ${
                    p.dagen === dagen
                      ? "border-primary bg-primary-light"
                      : "border-line hover:bg-surface"
                  }`}
                >
                  <span className="block text-sm font-medium text-ink">{p.label}</span>
                  <span className="block text-meta text-ink-faint">{p.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <ol className="mt-5 flex flex-col gap-0 border-t border-line">
            {STAPPEN.map((stap, i) => {
              const stand = standen[stap.deel] ?? { soort: "wacht" as const };
              return (
                <li
                  key={stap.deel}
                  className="flex items-start gap-3 border-b border-line py-3"
                >
                  <Merkteken stand={stand} nummer={i + 1} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{stap.label}</p>
                    <p className="text-meta text-ink-faint">{stap.toelichting}</p>
                    {stand.soort === "klaar" && (
                      <p className="mt-1 text-meta text-positive">
                        {stand.geschreven.toLocaleString("nl-NL")} rijen weggeschreven in{" "}
                        {stand.seconden} seconden
                      </p>
                    )}
                    {stand.soort === "klaar" && stand.waarschuwing && (
                      <p className="mt-1 text-meta text-ink-muted">{stand.waarschuwing}</p>
                    )}
                    {stand.soort === "fout" && (
                      <p className="mt-1 text-meta text-negative">{stand.bericht}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {afgerond && (
            <p className="mt-4 text-sm text-positive">
              Klaar. De pagina&apos;s tonen nu de nieuwe cijfers.
            </p>
          )}

          <div className="mt-5 flex items-center justify-end gap-2">
            {!bezig && (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-button px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface"
              >
                Sluiten
              </button>
            )}
            <button
              type="button"
              onClick={start}
              disabled={bezig}
              className="flex items-center gap-2 rounded-button bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-opacity disabled:cursor-wait disabled:opacity-70"
            >
              {bezig && <IconRefresh className="h-4 w-4 animate-spin" />}
              {bezig ? "Bezig…" : afgerond ? "Opnieuw ophalen" : "Starten"}
            </button>
          </div>

          {bezig && (
            <p className="mt-3 text-meta text-ink-faint">
              Laat dit venster open staan tot het klaar is. Bij twaalf maanden kan een stap
              een paar minuten duren.
            </p>
          )}
        </Modal>
      )}
    </>
  );
}

function Merkteken({ stand, nummer }: { stand: Stand; nummer: number }) {
  const basis =
    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-pill text-meta";
  if (stand.soort === "bezig") {
    return (
      <span className={`${basis} bg-primary-light text-primary`}>
        <IconRefresh className="h-3.5 w-3.5 animate-spin" />
      </span>
    );
  }
  if (stand.soort === "klaar") {
    return (
      <span className={`${basis} bg-open-light text-positive`}>
        <IconCheck className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (stand.soort === "fout") {
    return (
      <span className={`${basis} bg-surface text-negative`}>
        <IconClose className="h-3.5 w-3.5" />
      </span>
    );
  }
  return <span className={`${basis} bg-surface text-ink-faint`}>{nummer}</span>;
}
