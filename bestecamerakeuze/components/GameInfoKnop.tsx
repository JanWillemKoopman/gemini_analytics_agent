"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { IconInfo } from "@/components/icons";
import { PUNTEN_PER_SOORT, STREAK_BONUS, WEEKDOEL_PER_COLLEGA } from "@/lib/punten";
import { RESET_LABEL } from "@/lib/week";

/**
 * Knop + pop-up die uitleggen hoe de gamification van het scorebord werkt. Staat in de
 * PageHeader, op de plek waar eerder "Laatst bijgewerkt" stond — dat gaf geen zinvolle
 * context meer nu de sheet toch bij elke request opnieuw wordt opgehaald, en deze plek
 * (rechtsboven, altijd zichtbaar) leent zich beter voor uitleg die je maar één keer per
 * keer hoeft te lezen dan voor een tijdstip dat niemand echt gebruikt.
 *
 * De inhoud leest de echte constanten uit lib/punten.ts en lib/week.ts in plaats van de
 * cijfers hier over te typen — verandert de puntenweging of het resetmoment ooit, dan
 * klopt deze uitleg vanzelf weer mee.
 */
export default function GameInfoKnop() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm text-ink-muted transition-colors duration-[var(--duur-snel)] hover:text-ink"
      >
        <IconInfo className="h-4 w-4" />
        Game info
      </button>

      {open && (
        <Modal title="Hoe werkt het scorebord?" onClose={() => setOpen(false)}>
          <div className="space-y-5 text-sm text-ink">
            <section>
              <h3 className="font-sans-w7 text-xs font-bold uppercase tracking-wide text-ink-faint">
                Punten verdienen
              </h3>
              <p className="mt-1.5 text-ink-muted">
                Elk bericht dat je vastlegt in het besluitenlogboek of bij Kennis en
                acties levert punten op — hoe zwaarder het weegt in het overleg, hoe
                meer punten:
              </p>
              <ul className="mt-2 space-y-1 text-ink-muted">
                <li>
                  <span className="font-sans-w7 text-ink">
                    Hypothese — {PUNTEN_PER_SOORT.hypothese} punten
                  </span>{" "}
                  (een verwachting die later fout of gelijk kan blijken)
                </li>
                <li>
                  <span className="font-sans-w7 text-ink">
                    Observatie — {PUNTEN_PER_SOORT.observatie} punten
                  </span>
                </li>
                <li>
                  <span className="font-sans-w7 text-ink">
                    Besluit — {PUNTEN_PER_SOORT.besluit} punten
                  </span>
                </li>
                <li>
                  <span className="font-sans-w7 text-ink">
                    Actie — {PUNTEN_PER_SOORT.actie} punten
                  </span>{" "}
                  (volgt meestal vanzelf uit een besluit)
                </li>
              </ul>
            </section>

            <section>
              <h3 className="font-sans-w7 text-xs font-bold uppercase tracking-wide text-ink-faint">
                De puntenweek
              </h3>
              <p className="mt-1.5 text-ink-muted">
                Een week loopt van {RESET_LABEL} tot de volgende {RESET_LABEL}{" "}
                (Nederlandse tijd). Op dat moment gaat de weekstand terug naar nul en
                worden de medailles van de nieuwe week opnieuw verdeeld — alles wat je
                daarvoor vastlegde, telt nog mee voor de week die net is afgesloten.
              </p>
            </section>

            <section>
              <h3 className="font-sans-w7 text-xs font-bold uppercase tracking-wide text-ink-faint">
                Streaks
              </h3>
              <p className="mt-1.5 text-ink-muted">
                Leg je twee weken op rij iets vast, dan levert die tweede week (en elke
                volgende week dat je de reeks voortzet) een bonus van {STREAK_BONUS}{" "}
                punten op. Sla je een week over, dan begint je streak weer bij nul — de
                allereerste week van een nieuwe reeks geeft nog geen bonus.
              </p>
            </section>

            <section>
              <h3 className="font-sans-w7 text-xs font-bold uppercase tracking-wide text-ink-faint">
                Medailles #1, #2, #3
              </h3>
              <p className="mt-1.5 text-ink-muted">
                Aan het eind van elke week krijgen de drie hoogste puntentotalen een
                medaille (goud, zilver, brons) op het weekscherm. Sta je gelijk met
                iemand anders, dan krijgen jullie dezelfde medaille. Nul punten levert
                nooit een medaille op — een rustige week hoort niet bekroond te worden.
                Behaalde medailles van afgesloten weken tellen op in je persoonlijke
                prijzenkast (de totaalstand hieronder).
              </p>
            </section>

            <section>
              <h3 className="font-sans-w7 text-xs font-bold uppercase tracking-wide text-ink-faint">
                Teamdoel
              </h3>
              <p className="mt-1.5 text-ink-muted">
                Het team heeft samen een weekdoel van {WEEKDOEL_PER_COLLEGA} punten per
                collega — dat doel groeit automatisch mee als er iemand bijkomt. Het is
                bewust een gezamenlijk doel, geen individuele lat: een rustige week is
                een zaak van het hele team.
              </p>
            </section>

            <section>
              <h3 className="font-sans-w7 text-xs font-bold uppercase tracking-wide text-ink-faint">
                De totaalstand
              </h3>
              <p className="mt-1.5 text-ink-muted">
                Los van de wekelijkse reset telt de totaalstand alles bij elkaar op
                sinds je allereerste bericht: je totale punten, je langste streak en
                hoe vaak je goud, zilver of brons hebt gehaald. Die stand heeft geen
                einddatum en start dus nooit opnieuw.
              </p>
            </section>
          </div>
        </Modal>
      )}
    </>
  );
}
