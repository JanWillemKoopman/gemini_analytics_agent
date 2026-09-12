"use client";

import { useMemo, useState } from "react";
import Avatar from "@/components/Avatar";
import { SOORTEN, SOORT_LABEL } from "@/lib/notities";
import {
  PUNTEN_PER_SOORT,
  bepaalPositie,
  berekenPuntenstanden,
  bijdrageprofielen,
  legeStand,
  type PuntenPeriode,
} from "@/lib/punten";
import { formatNumber } from "@/lib/format";
import { useTeamData, type Profiel } from "@/lib/teamData";

const PERIODES: { waarde: PuntenPeriode; label: string }[] = [
  { waarde: 30, label: "30 dagen" },
  { waarde: 90, label: "90 dagen" },
  { waarde: null, label: "Alles" },
];

/** "+25%" / "−10%" / "nieuw" — nooit een oneindig percentage als er niets was om mee te vergelijken. */
function Verandering({ verandering, punten }: { verandering: number | null; punten: number }) {
  if (verandering === null) {
    return <span className="text-xs text-ink-faint">{punten > 0 ? "nieuw" : "—"}</span>;
  }
  if (verandering === 0) return <span className="text-xs text-ink-faint">gelijk</span>;

  const omhoog = verandering > 0;
  return (
    <span className={`text-xs tabular-nums ${omhoog ? "text-positive" : "text-negative"}`}>
      {omhoog ? "+" : "−"}
      {Math.abs(verandering)}%
    </span>
  );
}

function formatDatum(iso: string): string {
  const datum = new Date(iso);
  if (Number.isNaN(datum.getTime())) return "";
  return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" }).format(datum);
}

/**
 * Het kaartje dat bij het zweven over een avatar verschijnt: waar komen die punten
 * vandaan? Zonder deze uitsplitsing is een totaal een cijfer zonder verhaal — en dan
 * kun je er ook niets van leren.
 */
function Bijdragekaart({
  naam,
  perSoort,
  laatste,
}: {
  naam: string;
  perSoort: Record<string, number>;
  laatste: string | null;
}) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-full z-30 hidden w-52 -translate-x-1/2 translate-y-1 rounded-card border border-line bg-card p-3 text-left shadow-dropdown group-hover:block group-focus-within:block">
      <p className="font-sans-w7 text-xs font-bold text-ink">{naam}</p>
      <ul className="mt-2 flex flex-col gap-1">
        {SOORTEN.map((soort) => (
          <li key={soort.waarde} className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-ink-muted">{SOORT_LABEL[soort.waarde]}</span>
            <span className="tabular-nums text-ink">
              {perSoort[soort.waarde] ?? 0}
              <span className="text-ink-faint">
                {" "}
                × {PUNTEN_PER_SOORT[soort.waarde]}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 border-t border-line-soft pt-2 text-xs text-ink-faint">
        {laatste ? `Laatste bijdrage ${formatDatum(laatste)}` : "Nog niets in deze periode"}
      </p>
    </div>
  );
}

/**
 * De rij collega's met hun punten over de gekozen periode (30 dagen, 90 dagen of alles).
 *
 * Bewust alfabetisch en zonder medailles: je vindt een collega altijd op dezelfde plek,
 * en wie er deze week wint staat in de weekstand hieronder. Iedereen met een account
 * staat erop, ook wie nog niets heeft vastgelegd — die lege nul is de uitnodiging, en
 * voor jezelf staat er meteen een knop bij om er iets aan te doen.
 */
export default function TeamScorebord() {
  const { berichten, profielen, eigenId, nu, openZijbalk } = useTeamData();
  const [periode, setPeriode] = useState<PuntenPeriode>(30);

  const standen = useMemo(
    () => berekenPuntenstanden(berichten, periode, nu),
    [berichten, periode, nu],
  );
  const verdeling = useMemo(
    () => bijdrageprofielen(berichten, periode, nu),
    [berichten, periode, nu],
  );

  // De volgorde is en blijft alfabetisch — je vindt een collega op naam, niet op stand.
  const opNaam = useMemo(
    () =>
      [...profielen].sort((a: Profiel, b: Profiel) =>
        (a.naam ?? "").localeCompare(b.naam ?? "", "nl", { sensitivity: "base" }),
      ),
    [profielen],
  );

  const positie = eigenId
    ? bepaalPositie(
        opNaam.map((profiel) => ({
          id: profiel.id,
          punten: (standen[profiel.id] ?? legeStand(periode)).punten,
        })),
        eigenId,
      )
    : null;

  const periodeLabel = periode === null ? "sinds het begin" : `in de laatste ${periode} dagen`;

  return (
    <section className="kaart-omlijst rounded-panel border border-line bg-card px-5 py-4 shadow-subtle">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-sans-w7 text-sm font-bold text-ink">Het team</p>
          <p className="mt-0.5 text-xs text-ink-faint">
            Punten {periodeLabel}
            {periode !== null && ", vergeleken met de periode daarvóór"}.
          </p>
        </div>

        <div className="flex items-center gap-0.5 rounded-control bg-surface p-0.5">
          {PERIODES.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setPeriode(p.waarde)}
              aria-pressed={periode === p.waarde}
              className={`rounded-control px-2.5 py-1 text-xs font-medium transition-colors duration-[var(--duur-snel)] ease-merk ${
                periode === p.waarde
                  ? "bg-card text-ink shadow-card"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {profielen.length === 0 ? (
        <p className="mt-4 text-sm text-ink-faint">Nog geen collega&apos;s met een account.</p>
      ) : (
        // auto-fit i.p.v. een flexrij: de collega's verdelen zich zo over de volle
        // breedte van de kaart (en wrappen netjes zodra het er veel worden).
        <ul className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-y-5">
          {opNaam.map((profiel) => {
            const stand = standen[profiel.id] ?? legeStand(periode);
            const bijdrage = verdeling[profiel.id];
            const jij = profiel.id === eigenId;
            return (
              <li
                key={profiel.id}
                className="group relative flex flex-col items-center gap-1.5 text-center"
              >
                <span className="relative inline-flex" tabIndex={0}>
                  <Avatar
                    naam={profiel.naam}
                    avatarUrl={profiel.avatarUrl}
                    size={48}
                    className={jij ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""}
                  />
                </span>
                <span
                  className="max-w-full truncate text-xs text-ink-muted"
                  title={profiel.naam ?? ""}
                >
                  {jij ? "Jij" : profiel.naam || "Naamloos"}
                </span>
                <span
                  className={`font-sans-w7 text-cell font-bold tabular-nums ${
                    stand.punten > 0 ? "text-ink" : "text-ink-faint"
                  }`}
                >
                  {formatNumber(stand.punten)}
                </span>
                <Verandering verandering={stand.verandering} punten={stand.punten} />

                <Bijdragekaart
                  naam={profiel.naam || "Naamloos"}
                  perSoort={bijdrage?.perSoort ?? {}}
                  laatste={bijdrage?.laatste ?? null}
                />
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-3">
        {/* Bewust zonder streakbonus: die hoort bij een hele week, niet bij een
            voortschrijdend venster van 30 of 90 dagen. In de weekstand en de totaalstand
            hieronder telt hij wel mee. */}
        <p className="text-xs text-ink-faint">
          {SOORTEN.map((s) => `${s.label} ${PUNTEN_PER_SOORT[s.waarde]}`).join(" · ")} punten per
          bericht, zonder streakbonus.
        </p>

        {/* Je eigen plek staat er alleen voor jou bij: de rij hierboven blijft een
            overzicht, geen ranglijst, maar zonder je eigen positie zegt een stand niets. */}
        {positie && (
          <p className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            <span>
              Jij staat <span className="font-sans-w7 font-bold text-ink">#{positie.plek}</span> van{" "}
              {positie.van}
              {positie.achterstand > 0
                ? ` · ${formatNumber(positie.achterstand)} punten achter`
                : " · koploper"}
              .
            </span>
            {(standen[eigenId ?? ""]?.punten ?? 0) === 0 && (
              <button
                type="button"
                onClick={openZijbalk}
                className="rounded-control bg-primary px-2.5 py-1 text-xs font-medium text-on-primary transition-colors hover:bg-primary-dark"
              >
                Leg je eerste observatie vast
              </button>
            )}
          </p>
        )}
      </div>
    </section>
  );
}
