"use client";

import Avatar from "@/components/Avatar";
import { useTeamData, type Bericht, type Profiel } from "@/lib/teamData";

/** Hele dagen tussen toen en nu. */
function dagenGeleden(iso: string, nu: Date): number {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((nu.getTime() - t) / (24 * 60 * 60 * 1000)));
}

/**
 * Wie heeft er nog acties openstaan, en hoe oud is de oudste?
 *
 * Bewust geen punten en geen medaille: een openstaande actie is geen score maar een
 * schuld aan het team. Dat het zichtbaar is, is het hele mechanisme — en "oudste 12
 * dagen" zegt oneindig veel meer dan "3 open".
 *
 * De toewijzing is die van wie de actie noteerde; de tabel kent geen aparte eigenaar.
 * Dat is eerlijk zo opgeschreven, want anders lijkt er een toewijzing te zijn die er
 * niet is.
 */
export default function OpenActies({ acties }: { acties: Bericht[] }) {
  const { profielPerId, nu } = useTeamData();

  const perPersoon = new Map<string, { open: number; oudste: number }>();
  for (const actie of acties) {
    if (actie.afgerondOp !== null) continue;
    const huidig = perPersoon.get(actie.aangemaaktDoor) ?? { open: 0, oudste: 0 };
    huidig.open += 1;
    huidig.oudste = Math.max(huidig.oudste, dagenGeleden(actie.aangemaaktOp, nu));
    perPersoon.set(actie.aangemaaktDoor, huidig);
  }

  if (perPersoon.size === 0) return null;

  // Meeste openstaande acties eerst; bij gelijk aantal de oudste bovenaan.
  const rijen = Array.from(perPersoon.entries()).sort(
    (a, b) => b[1].open - a[1].open || b[1].oudste - a[1].oudste,
  );

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface-tint px-5 py-3">
      <p className="label-theme text-label text-ink-faint">Open, genoteerd door</p>
      {rijen.map(([id, stand]) => {
        const profiel: Profiel | undefined = profielPerId[id];
        return (
          <span key={id} className="flex items-center gap-2">
            <Avatar naam={profiel?.naam ?? null} avatarUrl={profiel?.avatarUrl ?? null} size={22} />
            <span className="text-sm text-ink">
              <span className="font-medium">{profiel?.naam || "Onbekend"}</span>{" "}
              <span className="tabular-nums text-ink-muted">{stand.open}</span>
              <span className="text-ink-faint">
                {" "}
                · oudste {stand.oudste} {stand.oudste === 1 ? "dag" : "dagen"}
              </span>
            </span>
          </span>
        );
      })}
    </div>
  );
}
