"use client";

import { useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import Visual, { type Weergave } from "@/components/chat/Visual";
import { IconRefresh, IconTrash } from "@/components/icons";

/**
 * Het prikbord: de grafieken die het team uit de chat heeft vastgepind.
 *
 * Zo groeit het dashboard uit de vragen die er echt leven, in plaats van uit wat de
 * bouwer vooraf bedacht. Elk item bewaart zijn eigen query, dus "verversen" haalt
 * dezelfde grafiek met verse cijfers op — de momentopname eronder blijft staan zolang
 * dat niet gebeurt, met de datum erbij zodat niemand een oud cijfer voor vandaag aanziet.
 */

interface PrikbordItem {
  id: string;
  titel: string;
  vraag: string | null;
  sql: string;
  weergave: Weergave;
  kolommen: string[];
  rijen: Record<string, unknown>[];
  ververstOp: string;
  aangemaaktDoor: string;
}

interface Profiel {
  naam: string | null;
  avatarUrl: string | null;
}

function formatMoment(iso: string): string {
  const datum = new Date(iso);
  if (Number.isNaN(datum.getTime())) return "";
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(datum);
}

export default function Prikbord({ ingelogd }: { ingelogd: boolean }) {
  const [items, setItems] = useState<PrikbordItem[] | null>(null);
  const [profielen, setProfielen] = useState<Record<string, Profiel>>({});
  const [fout, setFout] = useState<string | null>(null);
  const [bezigId, setBezigId] = useState<string | null>(null);

  useEffect(() => {
    if (!ingelogd) return;
    let genegeerd = false;
    fetch("/api/prikbord")
      .then((res) => res.json())
      .then((json) => {
        if (genegeerd) return;
        if (json.fout) throw new Error(json.fout);
        setItems(json.items as PrikbordItem[]);
        setProfielen(json.profielen as Record<string, Profiel>);
      })
      .catch((err) => {
        if (!genegeerd) setFout(err instanceof Error ? err.message : "Kon het prikbord niet ophalen.");
      });
    return () => {
      genegeerd = true;
    };
  }, [ingelogd]);

  async function ververs(id: string) {
    setBezigId(id);
    setFout(null);
    try {
      const res = await fetch(`/api/prikbord/${id}`, { method: "PATCH" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.fout ?? "Kon niet verversen.");
      const item = json.item as PrikbordItem;
      setItems((prev) => (prev ?? []).map((i) => (i.id === id ? item : i)));
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Kon niet verversen.");
    } finally {
      setBezigId(null);
    }
  }

  async function verwijder(id: string) {
    setFout(null);
    try {
      const res = await fetch(`/api/prikbord/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).fout ?? "Kon niet verwijderen.");
      setItems((prev) => (prev ?? []).filter((i) => i.id !== id));
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Kon niet verwijderen.");
    }
  }

  if (!ingelogd) {
    return (
      <div className="rounded-panel border border-line bg-surface p-8 text-center">
        <p className="font-sans-w7 text-lg font-bold text-ink">Log in om het prikbord te zien</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
          Het prikbord is gedeeld: iedereen ziet dezelfde vastgepinde grafieken.
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

  return (
    <div className="flex flex-col gap-4">
      {fout && (
        <p className="rounded-card border border-orange bg-card px-4 py-3 text-sm text-orange">{fout}</p>
      )}

      {items === null ? (
        <div className="h-64 rounded-panel border border-line bg-surface" />
      ) : items.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface px-6 py-12 text-center">
          <p className="font-sans-w7 text-lg font-bold text-ink">Nog niets vastgepind</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
            Stel een vraag bij <span className="font-medium text-ink">Start gesprek</span> en pin het
            antwoord vast met het punaise-knopje. Wat hier staat, staat er voor het hele team — en is
            elke week met één klik weer actueel.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {items.map((item) => {
            const profiel = profielen[item.aangemaaktDoor];
            return (
              <article key={item.id} className="flex flex-col rounded-panel border border-line bg-card p-4">
                <header className="mb-1 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {item.vraag && (
                      <p className="truncate text-sm font-medium text-ink" title={item.vraag}>
                        {item.vraag}
                      </p>
                    )}
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-faint">
                      <Avatar naam={profiel?.naam ?? null} avatarUrl={profiel?.avatarUrl ?? null} size={16} />
                      <span className="truncate">{profiel?.naam || "Onbekend"}</span>
                      <span aria-hidden="true">·</span>
                      <span>bijgewerkt {formatMoment(item.ververstOp)}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => void ververs(item.id)}
                      disabled={bezigId === item.id}
                      title="Query opnieuw draaien"
                      aria-label="Verversen"
                      className="flex h-7 w-7 items-center justify-center rounded-control text-ink-faint transition-colors hover:bg-surface hover:text-ink disabled:opacity-40"
                    >
                      <IconRefresh className={`h-4 w-4 ${bezigId === item.id ? "animate-spin" : ""}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void verwijder(item.id)}
                      title="Van het prikbord halen"
                      aria-label="Verwijderen"
                      className="flex h-7 w-7 items-center justify-center rounded-control text-ink-faint transition-colors hover:bg-surface hover:text-negative"
                    >
                      <IconTrash className="h-4 w-4" />
                    </button>
                  </div>
                </header>

                <Visual weergave={item.weergave} kolommen={item.kolommen} rijen={item.rijen} />

                {/* Ook hier de query erbij: een cijfer op een bord zonder herkomst is een
                    cijfer waarover je gaat discussiëren in plaats van mee werken. */}
                <details className="mt-auto">
                  <summary className="cursor-pointer text-xs text-ink-faint hover:text-ink-muted">
                    Query bekijken
                  </summary>
                  <pre className="mt-2 overflow-x-auto rounded-card bg-surface p-3 text-xs leading-relaxed text-ink">
                    {item.sql}
                  </pre>
                </details>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
