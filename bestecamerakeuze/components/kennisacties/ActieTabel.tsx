"use client";

import { useMemo } from "react";
import Avatar from "@/components/Avatar";
import OpenActies from "@/components/kennisacties/OpenActies";
import { IconCheck } from "@/components/icons";
import { useTeamData, type Bericht } from "@/lib/teamData";

function formatDatum(iso: string): string {
  const datum = new Date(iso);
  if (Number.isNaN(datum.getTime())) return "";
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(datum);
}

function dagenGeleden(iso: string, nu: Date): number {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((nu.getTime() - t) / (24 * 60 * 60 * 1000)));
}

/**
 * Alle acties die het team heeft genoteerd, met een vinkje om ze af te ronden.
 *
 * Waarom naast de berichtentabel: in die tabel staat een actie tussen de observaties en
 * besluiten in, en verdwijnt hij naar beneden zodra er nieuwere berichten bijkomen. Een
 * actie is het enige soort bericht dat om een vervolg vraagt, en hoort dus een eigen
 * lijst te hebben waarin je ziet wat er nog open staat — en waarin je hem kunt afvinken
 * zonder eerst de campagne op te zoeken.
 *
 * Open acties staan bovenaan, oudste eerst: wat het langst blijft liggen, valt het
 * eerst op. Afgeronde acties blijven staan (doorgestreept, onderaan) — een afgevinkte
 * actie is het bewijs dat er iets is gebeurd.
 */
export default function ActieTabel({ acties }: { acties: Bericht[] }) {
  const { profielPerId, nu, zetActie } = useTeamData();

  const gesorteerd = useMemo(
    () =>
      [...acties].sort((a, b) => {
        const aOpen = a.afgerondOp === null;
        const bOpen = b.afgerondOp === null;
        if (aOpen !== bOpen) return aOpen ? -1 : 1;
        // Open: oudste eerst. Afgerond: laatst afgerond eerst.
        return aOpen
          ? a.aangemaaktOp.localeCompare(b.aangemaaktOp)
          : (b.afgerondOp ?? "").localeCompare(a.afgerondOp ?? "");
      }),
    [acties],
  );

  const open = gesorteerd.filter((actie) => actie.afgerondOp === null).length;

  return (
    <section className="kaart-omlijst overflow-hidden rounded-panel border border-line bg-card shadow-subtle">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
        <div>
          <p className="font-sans-w7 text-sm font-bold text-ink">Acties</p>
          <p className="mt-0.5 text-xs text-ink-faint">
            Alles wat het team heeft afgesproken op te pakken. Vink af wat klaar is.
          </p>
        </div>
        <p className="text-xs text-ink-faint">
          <span className="tabular-nums">{open}</span> open ·{" "}
          <span className="tabular-nums">{gesorteerd.length - open}</span> afgerond
        </p>
      </div>

      <OpenActies acties={gesorteerd} />

      {gesorteerd.length === 0 ? (
        <p className="px-5 py-8 text-sm text-ink-faint">
          Nog geen acties genoteerd. Leg er een vast met het type &ldquo;Actie&rdquo;.
        </p>
      ) : (
        <table className="w-full border-separate border-spacing-0 text-left">
          <thead>
            <tr className="bg-surface-tint">
              {["", "Actie", "Campagne", "Wie", "Genoteerd", "Status"].map((kop, i) => (
                <th
                  key={kop || "vink"}
                  scope="col"
                  className={`label-theme border-y border-line px-2 py-2 text-label font-medium text-ink-faint ${
                    i === 0 ? "w-10 pl-5" : ""
                  } ${i === 5 ? "pr-5" : ""}`}
                >
                  {kop}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gesorteerd.map((actie) => {
              const profiel = profielPerId[actie.aangemaaktDoor];
              const afgerond = actie.afgerondOp !== null;
              const leeftijd = dagenGeleden(actie.aangemaaktOp, nu);
              return (
                <tr key={actie.id} className="align-top">
                  <td className="border-b border-line-soft py-3 pl-5 pr-2">
                    <button
                      type="button"
                      onClick={() => void zetActie(actie, !afgerond)}
                      aria-label={afgerond ? "Actie heropenen" : "Actie afvinken"}
                      aria-pressed={afgerond}
                      title={afgerond ? "Actie heropenen" : "Actie afvinken"}
                      className={`flex h-5 w-5 items-center justify-center rounded-control border transition-colors duration-[var(--duur-snel)] ease-merk ${
                        afgerond
                          ? "border-positive bg-positive text-on-primary"
                          : "border-line text-transparent hover:border-positive hover:text-positive"
                      }`}
                    >
                      <IconCheck className="h-3 w-3" />
                    </button>
                  </td>
                  <td
                    className={`border-b border-line-soft px-2 py-3 text-sm whitespace-pre-wrap ${
                      afgerond ? "text-ink-faint line-through" : "text-ink"
                    }`}
                  >
                    {actie.tekst}
                  </td>
                  <td className="border-b border-line-soft px-2 py-3 text-sm text-ink">
                    <span className="block max-w-[200px] truncate" title={actie.campagneNaam}>
                      {actie.campagneNaam}
                    </span>
                  </td>
                  <td className="whitespace-nowrap border-b border-line-soft px-2 py-3">
                    <span className="flex items-center gap-2" title={profiel?.naam ?? "Onbekend"}>
                      <Avatar
                        naam={profiel?.naam ?? null}
                        avatarUrl={profiel?.avatarUrl ?? null}
                        size={22}
                      />
                      <span className="text-sm text-ink">{profiel?.naam || "Onbekend"}</span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap border-b border-line-soft px-2 py-3 text-sm tabular-nums text-ink-muted">
                    {formatDatum(actie.aangemaaktOp)}
                  </td>
                  <td className="whitespace-nowrap border-b border-line-soft py-3 pl-2 pr-5 text-sm">
                    {afgerond ? (
                      <span className="text-positive">
                        Afgerond {formatDatum(actie.afgerondOp as string)}
                      </span>
                    ) : (
                      <span className={leeftijd >= 14 ? "text-negative" : "text-ink-muted"}>
                        Open · {leeftijd} {leeftijd === 1 ? "dag" : "dagen"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
