"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LEGE_KUBUS, type Kubus, type Selectie } from "@/lib/kanalen/kubus";

/**
 * Het ophalen van één Kanalen-pagina, en de filterselectie eromheen.
 *
 * De periode is de énige keuze die een nieuwe ophaalactie veroorzaakt. Alle andere
 * filters werken op wat er al in het geheugen staat — zie `lib/kanalen/kubus.ts`.
 */

export type PaginaSleutel = "social" | "google" | "organisch" | "account" | "koppeltabel";

export interface PeriodeKeuze {
  id: string;
  label: string;
  dagen: number;
}

/**
 * De vaste periodes.
 *
 * Er zit bewust geen vrije datumkiezer bij: negen van de tien keer wil een marketeer
 * "de afgelopen maand" of "dit kwartaal", en een kalender met twee velden is dan drie
 * handelingen voor iets wat één klik hoort te zijn. Komt de vraag om een eigen periode,
 * dan is dit de plek.
 */
export const PERIODES: PeriodeKeuze[] = [
  { id: "7d", label: "7 dagen", dagen: 7 },
  { id: "30d", label: "30 dagen", dagen: 30 },
  { id: "90d", label: "90 dagen", dagen: 90 },
  { id: "12m", label: "12 maanden", dagen: 365 },
];

/**
 * De periode loopt tot en met **gisteren**, niet tot en met vandaag.
 *
 * De sync draait 's nachts, dus van vandaag staat er hooguit een fractie in de database
 * — en die halve dag verscheen als een ingezakte laatste staaf in elke grafiek. Een
 * kolom die alleen maar zegt "de nacht is nog niet geweest" hoort er niet te staan.
 */
export function periodeGrenzen(dagen: number): { van: string; tot: string } {
  const tot = new Date();
  tot.setUTCDate(tot.getUTCDate() - 1);
  const van = new Date(tot);
  van.setUTCDate(van.getUTCDate() - (dagen - 1));
  return { van: van.toISOString().slice(0, 10), tot: tot.toISOString().slice(0, 10) };
}

export interface KanaalAntwoord {
  reeks?: Kubus;
  detail?: Kubus;
  koppelingen?: unknown[];
  laatsteSync?: string | null;
  fout?: string;
}

export interface KanaalData {
  reeks: Kubus;
  detail: Kubus;
  ruw: KanaalAntwoord | null;
  bezig: boolean;
  fout: string | null;
  laatsteSync: string | null;
  herlaad: () => void;
}

export function useKanaalData(pagina: PaginaSleutel, dagen: number): KanaalData {
  const [antwoord, setAntwoord] = useState<KanaalAntwoord | null>(null);
  const [bezig, setBezig] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [teller, setTeller] = useState(0);

  const herlaad = useCallback(() => setTeller((t) => t + 1), []);

  useEffect(() => {
    let afgebroken = false;
    const { van, tot } = periodeGrenzen(dagen);

    setBezig(true);
    setFout(null);

    // `reload` bij een handmatige ververs: het antwoord draagt `max-age=300,
    // stale-while-revalidate=3600`, dus zonder dit haalt de browser tot een uur lang zijn
    // eigen kopie op en levert de knop precies niets. Dat viel vooral op na "Data
    // ophalen" — dan keek je na een verse sync nog steeds naar de oude cijfers.
    fetch(`/api/kanalen?pagina=${pagina}&van=${van}&tot=${tot}`, {
      cache: teller > 0 ? "reload" : "default",
    })
      .then(async (res) => {
        const data = (await res.json()) as KanaalAntwoord;
        if (afgebroken) return;
        if (!res.ok) {
          setFout(data.fout ?? `De data kon niet worden opgehaald (${res.status}).`);
          setAntwoord(null);
          return;
        }
        setAntwoord(data);
      })
      .catch((err: unknown) => {
        if (afgebroken) return;
        setFout(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!afgebroken) setBezig(false);
      });

    return () => {
      afgebroken = true;
    };
  }, [pagina, dagen, teller]);

  return {
    reeks: antwoord?.reeks ?? LEGE_KUBUS,
    detail: antwoord?.detail ?? LEGE_KUBUS,
    ruw: antwoord,
    bezig,
    fout,
    laatsteSync: antwoord?.laatsteSync ?? null,
    herlaad,
  };
}

/** De filterselectie per dimensie, met de bewerkingen die de filterbalk nodig heeft. */
export function useSelectie(dimensies: string[]) {
  const leeg = useMemo(() => {
    const uit: Selectie = {};
    dimensies.forEach((d) => (uit[d] = []));
    return uit;
  }, [dimensies]);

  const [selectie, setSelectie] = useState<Selectie>(leeg);

  const zet = useCallback((dimensie: string, waarden: string[]) => {
    setSelectie((huidig) => ({ ...huidig, [dimensie]: waarden }));
  }, []);

  const wis = useCallback(() => setSelectie(leeg), [leeg]);

  const aantalActief = useMemo(
    () => Object.values(selectie).filter((v) => v.length > 0).length,
    [selectie],
  );

  return { selectie, zet, wis, aantalActief };
}
