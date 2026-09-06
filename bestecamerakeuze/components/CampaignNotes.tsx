"use client";

import { useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import Modal from "@/components/Modal";
import { IconNotes, IconPencil, IconPlus, IconTrash } from "@/components/icons";

interface Notitie {
  id: string;
  tekst: string;
  aangemaaktDoor: string;
}

interface Profiel {
  naam: string | null;
  avatarUrl: string | null;
}

type Props = {
  campagneNaam: string;
  ingelogd: boolean;
};

/**
 * Subtiel knopje in de campagnekop dat een pop-up opent met de aantekeningen/learnings
 * voor die campagne: een oplopende lijst van punten die iedereen mag toevoegen,
 * aanpassen of verwijderen. Elke aantekening toont wie hem heeft toegevoegd (avatar +
 * naam), zodat learnings herleidbaar blijven. Wordt alleen gerenderd wanneer Supabase
 * geconfigureerd is (zie CampaignHeader.tsx) — zonder database is er niets om op te
 * slaan.
 */
export default function CampaignNotes({ campagneNaam, ingelogd }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notitie[] | null>(null);
  const [profielen, setProfielen] = useState<Record<string, Profiel>>({});
  const [laden, setLaden] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [nieuw, setNieuw] = useState("");
  const [bezigMetToevoegen, setBezigMetToevoegen] = useState(false);
  const [bewerkId, setBewerkId] = useState<string | null>(null);
  const [bewerkTekst, setBewerkTekst] = useState("");

  useEffect(() => {
    if (!open || !ingelogd || items !== null) return;
    let genegeerd = false;
    setLaden(true);
    setFout(null);
    fetch(`/api/campagne-notities?campagne=${encodeURIComponent(campagneNaam)}`)
      .then((res) => res.json())
      .then((json) => {
        if (genegeerd) return;
        if (json.fout) throw new Error(json.fout);
        setItems(json.items as Notitie[]);
        setProfielen(json.profielen as Record<string, Profiel>);
      })
      .catch((err) => {
        if (!genegeerd) setFout(err instanceof Error ? err.message : "Kon aantekeningen niet ophalen.");
      })
      .finally(() => {
        if (!genegeerd) setLaden(false);
      });
    return () => {
      genegeerd = true;
    };
  }, [open, ingelogd, items, campagneNaam]);

  async function toevoegen() {
    const tekst = nieuw.trim();
    if (!tekst || bezigMetToevoegen) return;
    setBezigMetToevoegen(true);
    setFout(null);
    try {
      const res = await fetch("/api/campagne-notities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campagne: campagneNaam, tekst }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.fout ?? "Kon aantekening niet opslaan.");
      const item = json.item as Notitie;
      setItems((prev) => [...(prev ?? []), item]);
      setProfielen((prev) => ({ ...prev, [item.aangemaaktDoor]: json.profiel as Profiel }));
      setNieuw("");
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Kon aantekening niet opslaan.");
    } finally {
      setBezigMetToevoegen(false);
    }
  }

  async function opslaan(id: string) {
    const tekst = bewerkTekst.trim();
    if (!tekst) return;
    setFout(null);
    try {
      const res = await fetch(`/api/campagne-notities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tekst }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.fout ?? "Kon aantekening niet wijzigen.");
      setItems((prev) => (prev ?? []).map((i) => (i.id === id ? { ...i, tekst } : i)));
      setBewerkId(null);
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Kon aantekening niet wijzigen.");
    }
  }

  async function verwijderen(id: string) {
    setFout(null);
    try {
      const res = await fetch(`/api/campagne-notities/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.fout ?? "Kon aantekening niet verwijderen.");
      setItems((prev) => (prev ?? []).filter((i) => i.id !== id));
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Kon aantekening niet verwijderen.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Aantekeningen"
        aria-label={`Aantekeningen voor ${campagneNaam}`}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-faint transition-colors duration-150 hover:bg-surface hover:text-ink-muted"
      >
        <IconNotes className="h-3.5 w-3.5" />
      </button>

      {open && (
        <Modal title={`Aantekeningen — ${campagneNaam}`} onClose={() => setOpen(false)}>
          {!ingelogd ? (
            <div className="text-sm text-ink-muted">
              <p>Log in om aantekeningen te bekijken en toe te voegen.</p>
              <a
                href="/login"
                className="mt-3 inline-block rounded-button bg-primary px-4 py-1.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-dark"
              >
                Inloggen
              </a>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {fout && (
                <p className="rounded-card border border-orange bg-card px-3 py-2 text-xs text-orange">
                  {fout}
                </p>
              )}

              {laden && items === null ? (
                <p className="text-sm text-ink-faint">Laden…</p>
              ) : (items ?? []).length === 0 ? (
                <p className="text-sm text-ink-faint">Nog geen aantekeningen voor deze campagne.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {(items ?? []).map((item) => {
                    const profiel = profielen[item.aangemaaktDoor];
                    return (
                      <li
                        key={item.id}
                        className="flex items-start gap-2.5 rounded-card border border-line px-3 py-2"
                      >
                        <Avatar
                          naam={profiel?.naam ?? null}
                          avatarUrl={profiel?.avatarUrl ?? null}
                          size={22}
                          className="mt-0.5"
                        />
                        {bewerkId === item.id ? (
                          <div className="flex flex-1 flex-col gap-2">
                            <textarea
                              value={bewerkTekst}
                              onChange={(e) => setBewerkTekst(e.target.value)}
                              rows={2}
                              autoFocus
                              className="w-full resize-none rounded-control border border-line px-2 py-1.5 text-sm text-ink focus:border-primary focus:outline-none"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => opslaan(item.id)}
                                className="rounded-control bg-primary px-3 py-1 text-xs font-medium text-on-primary hover:bg-primary-dark"
                              >
                                Opslaan
                              </button>
                              <button
                                type="button"
                                onClick={() => setBewerkId(null)}
                                className="rounded-control px-3 py-1 text-xs font-medium text-ink-muted hover:bg-surface"
                              >
                                Annuleren
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium text-ink-faint">
                                {profiel?.naam || "Onbekend"}
                              </p>
                              <p className="whitespace-pre-wrap text-sm text-ink">{item.tekst}</p>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setBewerkId(item.id);
                                  setBewerkTekst(item.tekst);
                                }}
                                aria-label="Aantekening bewerken"
                                className="flex h-6 w-6 items-center justify-center rounded text-ink-faint hover:bg-surface hover:text-ink"
                              >
                                <IconPencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => verwijderen(item.id)}
                                aria-label="Aantekening verwijderen"
                                className="flex h-6 w-6 items-center justify-center rounded text-ink-faint hover:bg-surface hover:text-negative"
                              >
                                <IconTrash className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="flex items-end gap-2 border-t border-line pt-3">
                <textarea
                  value={nieuw}
                  onChange={(e) => setNieuw(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void toevoegen();
                    }
                  }}
                  placeholder="Nieuwe aantekening…"
                  rows={2}
                  className="w-full flex-1 resize-none rounded-control border border-line px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={toevoegen}
                  disabled={!nieuw.trim() || bezigMetToevoegen}
                  aria-label="Aantekening toevoegen"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-primary text-on-primary transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <IconPlus className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
