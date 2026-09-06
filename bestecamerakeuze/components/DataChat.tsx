"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import GesprekLijst, { type Gesprek } from "@/components/chat/GesprekLijst";
import Markdown from "@/components/chat/Markdown";
import Visual, { type Weergave } from "@/components/chat/Visual";
import { downloadCsv } from "@/lib/csv";
import {
  IconCheck,
  IconCopy,
  IconDownload,
  IconRefresh,
  IconThumbDown,
  IconThumbUp,
} from "@/components/icons";

/**
 * Het chatvenster.
 *
 * Gesprekken staan in de database, niet in het geheugen van de browser: een collega die
 * morgen terugkomt vindt zijn analyse terug, en op zijn telefoon dezelfde. De
 * geschiedenis wordt daarom ook niet door de browser meegestuurd — de server leest hem
 * uit de database, waar de rijbeveiliging bepaalt wat van wie is.
 *
 * Dit hele bestand wordt lui geladen (zie ChatPaneel.tsx), zodat wie alleen de
 * campagnetabel bekijkt er niets van meedraagt.
 */

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

interface Bericht {
  id?: number;
  rol: "gebruiker" | "assistent";
  tekst: string;
  queries?: QueryVerslag[];
  oordeel?: "goed" | "fout" | null;
}

const VOORBEELDVRAGEN = [
  "Hoeveel auto's van het merk DAF zijn verkocht in week 40 van 2025?",
  "Wat was de omzet per merk vorig kwartaal?",
  "Welke orders zijn wel getekend maar nog niet afgeleverd?",
];

/* --------------------------------------------------------------- deelcomponenten */

function ResultaatTabel({ verslag }: { verslag: QueryVerslag }) {
  if (verslag.rijen.length === 0 || verslag.kolommen.length === 0) return null;
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr>
            {verslag.kolommen.map((k) => (
              <th
                key={k}
                className="border-b border-line bg-accent px-3 py-2 text-left font-sans-w7 text-xs font-semibold tracking-wide text-ink uppercase"
              >
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {verslag.rijen.slice(0, 25).map((rij, i) => (
            <tr key={i} className={i % 2 === 1 ? "bg-surface" : "bg-card"}>
              {verslag.kolommen.map((k) => (
                <td key={k} className="px-3 py-2 text-ink tabular-nums">
                  {rij[k] === null || rij[k] === undefined ? "—" : String(rij[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {verslag.rijen.length > 25 && (
        <p className="mt-2 text-xs text-ink-faint">
          Eerste 25 van {verslag.rijen.length} getoonde rijen.
        </p>
      )}
    </div>
  );
}

function Verantwoording({ queries }: { queries: QueryVerslag[] }) {
  if (queries.length === 0) return null;
  return (
    <details className="mt-3 rounded-card border border-line bg-surface px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-ink-muted">
        Verantwoording — {queries.length} {queries.length === 1 ? "query" : "queries"}{" "}
        uitgevoerd
      </summary>
      <div className="mt-3 flex flex-col gap-4">
        {queries.map((q, i) => (
          <div key={i}>
            <p className="text-sm text-ink-muted">{q.toelichting}</p>
            <pre className="mt-1.5 overflow-x-auto rounded-card bg-card p-3 text-xs leading-relaxed text-ink">
              {q.sql}
            </pre>
            <p className="mt-1.5 text-xs text-ink-faint">
              {q.fout ? (
                <span className="text-orange">Mislukt: {q.fout}</span>
              ) : (
                <>
                  {q.aantalRijen} {q.aantalRijen === 1 ? "rij" : "rijen"} · {q.duurMs} ms
                </>
              )}
            </p>
            {!q.fout && q.weergave.vorm !== "tabel" && <ResultaatTabel verslag={q} />}
          </div>
        ))}
      </div>
    </details>
  );
}

function IconActieKnop({
  children,
  onClick,
  titel,
  actief,
  actiefKleur,
}: {
  children: React.ReactNode;
  onClick: () => void;
  titel: string;
  actief?: boolean;
  actiefKleur?: "primary" | "orange";
}) {
  const kleur = actiefKleur === "orange" ? "text-orange" : "text-primary";
  return (
    <button
      type="button"
      onClick={onClick}
      title={titel}
      aria-label={titel}
      className={`rounded-control p-1.5 transition-colors ${
        actief ? `${kleur} bg-surface` : "text-ink-faint hover:bg-surface hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function AntwoordActies({
  bericht,
  onKopieer,
  onOpnieuw,
  onOordeel,
  gekopieerd,
  kanOpnieuw,
}: {
  bericht: Bericht;
  onKopieer: () => void;
  onOpnieuw: () => void;
  onOordeel: (oordeel: "goed" | "fout") => void;
  gekopieerd: boolean;
  kanOpnieuw: boolean;
}) {
  const metRijen = (bericht.queries ?? []).filter((q) => !q.fout && q.rijen.length > 0);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-0.5">
      <IconActieKnop onClick={onKopieer} titel="Antwoord kopiëren">
        {gekopieerd ? <IconCheck className="h-4 w-4" /> : <IconCopy className="h-4 w-4" />}
      </IconActieKnop>
      {/* Feedback is hier geen tevredenheidsmeting maar een werklijst: een antwoord dat
          als fout is gemarkeerd wijst bijna altijd op iets wat nog in het
          datawoordenboek moet. */}
      <IconActieKnop
        onClick={() => onOordeel("goed")}
        titel="Dit antwoord klopt"
        actief={bericht.oordeel === "goed"}
      >
        <IconThumbUp className="h-4 w-4" />
      </IconActieKnop>
      <IconActieKnop
        onClick={() => onOordeel("fout")}
        titel="Dit antwoord klopt niet"
        actief={bericht.oordeel === "fout"}
        actiefKleur="orange"
      >
        <IconThumbDown className="h-4 w-4" />
      </IconActieKnop>
      {kanOpnieuw && (
        <IconActieKnop onClick={onOpnieuw} titel="Opnieuw beantwoorden">
          <IconRefresh className="h-4 w-4" />
        </IconActieKnop>
      )}
      {metRijen.length > 0 && (
        <>
          <span aria-hidden="true" className="mx-1 h-4 w-px bg-line" />
          {metRijen.map((q, i) => (
            <button
              key={i}
              type="button"
              onClick={() => downloadCsv(q.kolommen, q.rijen, q.weergave.titel || "resultaat")}
              title="Download als CSV voor Excel"
              className="flex items-center gap-1 rounded-control px-2 py-1.5 text-xs text-ink-faint transition-colors hover:bg-surface hover:text-ink"
            >
              <IconDownload className="h-3.5 w-3.5" />
              CSV{metRijen.length > 1 ? ` ${i + 1}` : ""}
            </button>
          ))}
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- hoofdcomponent */

export default function DataChat({ ingelogd }: { ingelogd: boolean }) {
  const [gesprekken, setGesprekken] = useState<Gesprek[]>([]);
  const [actiefId, setActiefId] = useState<string | null>(null);
  const [zoek, setZoek] = useState("");
  const [berichten, setBerichten] = useState<Bericht[]>([]);
  const [invoer, setInvoer] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fase, setFase] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [vervolgvragen, setVervolgvragen] = useState<string[]>([]);
  const [gekopieerd, setGekopieerd] = useState<number | null>(null);

  const onderkant = useRef<HTMLDivElement>(null);
  const invoerveld = useRef<HTMLTextAreaElement>(null);
  const afbreker = useRef<AbortController | null>(null);

  const laadGesprekken = useCallback(async (zoekterm: string) => {
    const res = await fetch(
      `/api/gesprekken${zoekterm ? `?zoek=${encodeURIComponent(zoekterm)}` : ""}`,
    );
    if (!res.ok) return;
    const data = (await res.json()) as { gesprekken: Gesprek[] };
    setGesprekken(data.gesprekken);
  }, []);

  useEffect(() => {
    if (!ingelogd) return;
    void laadGesprekken(zoek);
  }, [ingelogd, zoek, laadGesprekken]);

  async function openGesprek(id: string) {
    setActiefId(id);
    setVervolgvragen([]);
    setFout(null);
    const res = await fetch(`/api/gesprekken/${id}`);
    if (!res.ok) return;
    const data = (await res.json()) as { berichten: Bericht[] };
    setBerichten(
      data.berichten.map((b) => ({
        ...b,
        queries: (b.queries as unknown as QueryVerslag[]) ?? [],
      })),
    );
  }

  function nieuwGesprek() {
    setActiefId(null);
    setBerichten([]);
    setVervolgvragen([]);
    setFout(null);
    invoerveld.current?.focus();
  }

  async function hernoem(id: string, titel: string) {
    setGesprekken((g) => g.map((x) => (x.id === id ? { ...x, titel } : x)));
    await fetch(`/api/gesprekken/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titel }),
    });
  }

  async function verwijder(id: string) {
    setGesprekken((g) => g.filter((x) => x.id !== id));
    if (id === actiefId) nieuwGesprek();
    await fetch(`/api/gesprekken/${id}`, { method: "DELETE" });
  }

  async function geefOordeel(index: number, oordeel: "goed" | "fout") {
    const bericht = berichten[index];
    if (!bericht?.id) return;
    setBerichten((b) => b.map((x, i) => (i === index ? { ...x, oordeel } : x)));
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ berichtId: bericht.id, oordeel }),
    });
  }

  function stop() {
    afbreker.current?.abort();
  }

  async function verstuur(vraag: string, opnieuw = false) {
    if (!vraag.trim() || bezig) return;
    setFout(null);
    setVervolgvragen([]);
    setInvoer("");
    setBezig(true);
    setFase("denken");

    // Zonder actief gesprek eerst een nieuw aanmaken; de titel volgt automatisch na het
    // eerste antwoord.
    let gesprekId = actiefId;
    if (!gesprekId) {
      const res = await fetch("/api/gesprekken", { method: "POST" });
      if (!res.ok) {
        setFout("Kon geen nieuw gesprek starten.");
        setBezig(false);
        return;
      }
      const data = (await res.json()) as { gesprek: Gesprek };
      gesprekId = data.gesprek.id;
      setActiefId(gesprekId);
      setGesprekken((g) => [data.gesprek, ...g]);
    }

    if (opnieuw) {
      // De vorige beurt verdwijnt aan beide kanten: hier uit beeld, op de server uit de
      // database.
      setBerichten((b) => b.slice(0, -2));
    }
    setBerichten((b) => [...b, { rol: "gebruiker", tekst: vraag }]);

    let lopendAntwoord = "";
    const lopendeQueries: QueryVerslag[] = [];
    setBerichten((b) => [...b, { rol: "assistent", tekst: "", queries: [] }]);

    const werkBij = (extra: Partial<Bericht> = {}) =>
      setBerichten((b) => {
        const kopie = [...b];
        kopie[kopie.length - 1] = {
          ...kopie[kopie.length - 1],
          rol: "assistent",
          tekst: lopendAntwoord,
          queries: [...lopendeQueries],
          ...extra,
        };
        return kopie;
      });

    const controller = new AbortController();
    afbreker.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vraag, gesprekId, opnieuw }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const melding = await res
          .json()
          .then((j: { fout?: string }) => j.fout)
          .catch(() => null);
        throw new Error(melding ?? `Er ging iets mis (status ${res.status}).`);
      }

      const lezer = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await lezer.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const regels = buffer.split("\n");
        buffer = regels.pop() ?? "";

        for (const regel of regels) {
          if (!regel.trim()) continue;
          const g = JSON.parse(regel) as
            | { type: "fase"; fase: string }
            | { type: "tekst"; tekst: string }
            | ({ type: "query" } & QueryVerslag)
            | {
                type: "klaar";
                antwoord: string;
                queries: QueryVerslag[];
                berichtId: number | null;
                titel: string | null;
                vervolgvragen: string[];
              }
            | { type: "fout"; fout: string };

          if (g.type === "fase") {
            setFase(g.fase);
          } else if (g.type === "tekst") {
            lopendAntwoord += g.tekst;
            werkBij();
          } else if (g.type === "query") {
            const { type: _t, ...verslag } = g;
            lopendeQueries.push(verslag);
            werkBij();
          } else if (g.type === "klaar") {
            lopendAntwoord = g.antwoord;
            lopendeQueries.splice(0, lopendeQueries.length, ...g.queries);
            werkBij({ id: g.berichtId ?? undefined });
            setVervolgvragen(g.vervolgvragen ?? []);
            const nieuweTitel = g.titel;
            if (nieuweTitel && gesprekId) {
              const id = gesprekId;
              setGesprekken((lijst) =>
                lijst.map((x) => (x.id === id ? { ...x, titel: nieuweTitel } : x)),
              );
            }
          } else if (g.type === "fout") {
            throw new Error(g.fout);
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // Afgebroken door de gebruiker: houd wat er al binnen was en meld verder niets.
        werkBij({ tekst: lopendAntwoord || "_Gestopt._" });
      } else {
        setFout(err instanceof Error ? err.message : "Er ging iets mis.");
        setBerichten((b) =>
          b[b.length - 1]?.rol === "assistent" && b[b.length - 1]?.tekst === ""
            ? b.slice(0, -1)
            : b,
        );
      }
    } finally {
      afbreker.current = null;
      setBezig(false);
      setFase(null);
      onderkant.current?.scrollIntoView({ behavior: "smooth" });
    }
  }

  function opnieuwProberen() {
    const laatsteVraag = [...berichten].reverse().find((b) => b.rol === "gebruiker");
    if (laatsteVraag) void verstuur(laatsteVraag.tekst, true);
  }

  if (!ingelogd) {
    return (
      <div className="rounded-panel border border-line bg-surface p-8 text-center">
        <p className="font-sans-w7 text-lg font-bold text-ink">Log in om te chatten</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
          Deze data is niet openbaar. Log in met je werkmail om vragen te kunnen stellen.
        </p>
        <a
          href="/login"
          className="mt-5 inline-block rounded-button bg-primary px-5 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-dark"
        >
          Inloggen
        </a>
      </div>
    );
  }

  const leeg = berichten.length === 0;

  return (
    <div className="flex gap-8 lg:items-start">
      <GesprekLijst
        gesprekken={gesprekken}
        actiefId={actiefId}
        zoek={zoek}
        onZoek={setZoek}
        onKies={(id) => void openGesprek(id)}
        onNieuw={nieuwGesprek}
        onHernoem={(id, titel) => void hernoem(id, titel)}
        onVerwijder={(id) => void verwijder(id)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col">
          {leeg ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
              <div>
                <p className="font-sans-w7 text-2xl font-bold text-ink">
                  Stel een vraag over je data
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
                  Je krijgt antwoord op basis van echte queries op de database. Onder elk
                  antwoord zie je welke query is gedraaid, zodat je het kunt narekenen.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
                {VOORBEELDVRAGEN.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => void verstuur(v)}
                    className="rounded-control border border-line bg-card px-4 py-2.5 text-left text-sm text-ink transition-colors hover:border-primary/40 hover:bg-primary-light"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-8 pt-2 pb-6">
              {berichten.map((bericht, i) => (
                <div key={i}>
                  {bericht.rol === "gebruiker" ? (
                    <div className="flex justify-end">
                      <p className="max-w-[85%] rounded-panel bg-primary px-4 py-2.5 whitespace-pre-wrap text-on-primary">
                        {bericht.tekst}
                      </p>
                    </div>
                  ) : (
                    <div>
                      {/* De weergave staat boven de tekst: het antwoord is het beeld, de
                          tekst legt uit wat je erin ziet. */}
                      {bericht.queries
                        ?.filter((q) => !q.fout && q.weergave.vorm !== "verberg")
                        .map((q, j) => (
                          <Visual
                            key={j}
                            weergave={q.weergave}
                            kolommen={q.kolommen}
                            rijen={q.rijen}
                          />
                        ))}

                      {bericht.tekst ? (
                        <Markdown tekst={bericht.tekst} />
                      ) : (
                        bezig && <p className="text-ink-faint">…</p>
                      )}

                      {bericht.queries && bericht.queries.length > 0 && (
                        <Verantwoording queries={bericht.queries} />
                      )}

                      {!bezig && bericht.tekst && (
                        <AntwoordActies
                          bericht={bericht}
                          gekopieerd={gekopieerd === i}
                          kanOpnieuw={i === berichten.length - 1}
                          onKopieer={() => {
                            void navigator.clipboard.writeText(bericht.tekst);
                            setGekopieerd(i);
                            setTimeout(() => setGekopieerd(null), 2000);
                          }}
                          onOpnieuw={opnieuwProberen}
                          onOordeel={(o) => void geefOordeel(i, o)}
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}

              {bezig && (
                <p className="text-sm text-ink-faint">
                  {fase === "query"
                    ? "Query uitvoeren…"
                    : fase === "schrijven"
                      ? "Antwoord schrijven…"
                      : "Nadenken…"}
                </p>
              )}

              {!bezig && vervolgvragen.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs tracking-wide text-ink-faint uppercase">
                    Verder vragen
                  </span>
                  {vervolgvragen.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => void verstuur(v)}
                      className="rounded-button border border-line bg-card px-3.5 py-1.5 text-sm text-ink transition-colors hover:border-primary"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              )}

              {fout && (
                <p className="rounded-card border border-orange bg-card px-4 py-3 text-sm text-orange">
                  {fout}
                </p>
              )}
              <div ref={onderkant} />
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void verstuur(invoer);
            }}
            className="sticky bottom-4 z-10 flex items-end gap-2 rounded-panel border border-line bg-card p-2 shadow-dropdown"
          >
            <textarea
              ref={invoerveld}
              value={invoer}
              onChange={(e) => setInvoer(e.target.value)}
              onKeyDown={(e) => {
                // Enter verstuurt, shift+enter maakt een nieuwe regel — zoals mensen het uit
                // elke andere chat gewend zijn.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void verstuur(invoer);
                }
              }}
              rows={1}
              placeholder="Bijvoorbeeld: hoeveel DAF's zijn er vorige maand verkocht?"
              disabled={bezig}
              className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-60"
            />
            {bezig ? (
              <button
                type="button"
                onClick={stop}
                className="rounded-button border border-line bg-card px-5 py-2.5 font-medium text-ink transition-colors hover:border-primary"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!invoer.trim()}
                className="rounded-button bg-primary px-5 py-2.5 font-medium text-on-primary transition-colors hover:bg-primary-dark disabled:opacity-40"
              >
                Vraag
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
