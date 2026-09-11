"use client";

import { useEffect, useState } from "react";
import { IconLock, IconPlus, IconTrash } from "@/components/icons";

interface GebruikerRij {
  id: string;
  email: string;
  aangemaaktOp: string;
  vergrendeld: boolean;
}

function datumLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}

// Splitst op regels, komma's of puntkomma's — flexibel genoeg voor een geplakte lijst
// uit mail/Excel zonder dat de gebruiker eerst hoeft op te schonen.
function parseEmails(ruw: string): string[] {
  return Array.from(
    new Set(
      ruw
        .split(/[\n,;]/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );
}

/**
 * Instellingen → Gebruikers: collega-accounts in bulk aanmaken (met een gedeeld
 * standaardwachtwoord dat nergens op deze pagina zichtbaar is) en weer verwijderen.
 * Zichtbaar voor elke ingelogde collega; koopman.janwillem@gmail.com en
 * jkoopman@udenhout.nl zijn vergrendeld (niet verwijderbaar), en alleen
 * koopman.janwillem@gmail.com ziet de sectie om het standaardwachtwoord te wijzigen —
 * beide server-side afgedwongen in de /api/gebruikers-routes, niet alleen hier.
 */
export default function GebruikersBeheer({ isWachtwoordEigenaar }: { isWachtwoordEigenaar: boolean }) {
  const [gebruikers, setGebruikers] = useState<GebruikerRij[] | null>(null);
  const [laadFout, setLaadFout] = useState<string | null>(null);
  const [emailInvoer, setEmailInvoer] = useState("");
  const [bezigMetToevoegen, setBezigMetToevoegen] = useState(false);
  const [toevoegFout, setToevoegFout] = useState<string | null>(null);
  const [toevoegResultaat, setToevoegResultaat] = useState<string | null>(null);
  const [verwijderId, setVerwijderId] = useState<string | null>(null);

  async function laadGebruikers() {
    try {
      const res = await fetch("/api/gebruikers");
      const json = await res.json();
      if (!res.ok) throw new Error(json.fout ?? "Kon gebruikers niet ophalen.");
      setLaadFout(null);
      setGebruikers(json.gebruikers);
    } catch (err) {
      setLaadFout(err instanceof Error ? err.message : "Kon gebruikers niet ophalen.");
    }
  }

  useEffect(() => {
    void laadGebruikers();
  }, []);

  async function toevoegen(e: React.FormEvent) {
    e.preventDefault();
    const emails = parseEmails(emailInvoer);
    if (emails.length === 0) return;

    setBezigMetToevoegen(true);
    setToevoegFout(null);
    setToevoegResultaat(null);
    try {
      const res = await fetch("/api/gebruikers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.fout ?? "Kon gebruikers niet aanmaken.");

      const { aangemaakt, overgeslagen, mislukt } = json as {
        aangemaakt: string[];
        overgeslagen: string[];
        mislukt: { email: string; fout: string }[];
      };
      const delen: string[] = [];
      if (aangemaakt.length) delen.push(`${aangemaakt.length} account(s) aangemaakt`);
      if (overgeslagen.length) delen.push(`${overgeslagen.length} bestond(en) al`);
      if (mislukt.length) delen.push(`${mislukt.length} mislukt (${mislukt.map((m) => m.email).join(", ")})`);
      setToevoegResultaat(delen.join(" · ") || "Niets om toe te voegen.");
      setEmailInvoer("");
      await laadGebruikers();
    } catch (err) {
      setToevoegFout(err instanceof Error ? err.message : "Kon gebruikers niet aanmaken.");
    } finally {
      setBezigMetToevoegen(false);
    }
  }

  async function verwijderen(rij: GebruikerRij) {
    if (rij.vergrendeld) return;
    if (!confirm(`${rij.email} verwijderen? Dit account kan dan niet meer inloggen.`)) return;

    setVerwijderId(rij.id);
    try {
      const res = await fetch(`/api/gebruikers/${rij.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.fout ?? "Kon gebruiker niet verwijderen.");
      setGebruikers((prev) => prev?.filter((g) => g.id !== rij.id) ?? prev);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Kon gebruiker niet verwijderen.");
    } finally {
      setVerwijderId(null);
    }
  }

  return (
    <>
      <div className="mt-6 max-w-lg rounded-panel border border-line bg-card p-6 shadow-card">
        <p className="font-sans-w7 text-base font-bold text-ink">Collega&apos;s toevoegen</p>
        <p className="mt-1 text-sm text-ink-muted">
          Plak e-mailadressen (één per regel, of gescheiden door een komma). Ieder account
          krijgt meteen het standaardwachtwoord — dat wordt hier nergens getoond; de collega
          kan er direct mee inloggen op <span className="font-mono text-xs">/login</span>, en
          zelf later een eigen wachtwoord kiezen bij Instellingen.
        </p>
        <form onSubmit={toevoegen} className="mt-4 flex flex-col gap-2">
          <textarea
            rows={4}
            placeholder={"collega1@udenhout.nl\ncollega2@udenhout.nl"}
            value={emailInvoer}
            onChange={(e) => setEmailInvoer(e.target.value)}
            className="w-full rounded-control border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
          />
          {toevoegFout && (
            <p className="rounded-card border border-orange bg-card px-3 py-2 text-xs text-orange">
              {toevoegFout}
            </p>
          )}
          {toevoegResultaat && <p className="text-xs text-ink-muted">{toevoegResultaat}</p>}
          <button
            type="submit"
            disabled={bezigMetToevoegen || parseEmails(emailInvoer).length === 0}
            className="inline-flex w-fit items-center gap-1.5 rounded-control bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            <IconPlus className="h-4 w-4" />
            {bezigMetToevoegen ? "Bezig…" : "Toevoegen"}
          </button>
        </form>
      </div>

      <div className="mt-6 max-w-lg rounded-panel border border-line bg-card p-6 shadow-card">
        <p className="font-sans-w7 text-base font-bold text-ink">Accounts</p>
        {laadFout && (
          <p className="mt-3 rounded-card border border-orange bg-card px-3 py-2 text-xs text-orange">
            {laadFout}
          </p>
        )}
        {!gebruikers && !laadFout && <p className="mt-3 text-sm text-ink-faint">Laden…</p>}
        {gebruikers && (
          <ul className="mt-3 divide-y divide-line">
            {gebruikers.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-ink">{g.email}</span>
                    {g.vergrendeld && (
                      <IconLock className="h-3.5 w-3.5 flex-none text-ink-faint" aria-label="Vergrendeld" />
                    )}
                  </div>
                  <p className="text-xs text-ink-faint">sinds {datumLabel(g.aangemaaktOp)}</p>
                </div>
                <button
                  type="button"
                  disabled={g.vergrendeld || verwijderId === g.id}
                  onClick={() => void verwijderen(g)}
                  title={g.vergrendeld ? "Dit account is vergrendeld en kan niet verwijderd worden" : "Verwijderen"}
                  className="inline-flex flex-none items-center gap-1.5 rounded-control border border-line bg-card px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface hover:text-orange disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <IconTrash className="h-3.5 w-3.5" />
                  {verwijderId === g.id ? "Bezig…" : "Verwijderen"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isWachtwoordEigenaar && <StandaardWachtwoordPaneel />}
    </>
  );
}

// Alleen zichtbaar voor het ene account dat het gedeelde standaardwachtwoord mag
// wijzigen — server-side afgedwongen op /api/gebruikers/wachtwoord, dit is puur
// UI-gating.
function StandaardWachtwoordPaneel() {
  const [wachtwoord, setWachtwoord] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [opgeslagen, setOpgeslagen] = useState(false);

  async function opslaan(e: React.FormEvent) {
    e.preventDefault();
    setBezig(true);
    setFout(null);
    setOpgeslagen(false);
    try {
      const res = await fetch("/api/gebruikers/wachtwoord", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wachtwoord }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.fout ?? "Kon wachtwoord niet opslaan.");
      setWachtwoord("");
      setOpgeslagen(true);
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Kon wachtwoord niet opslaan.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="mt-6 max-w-lg rounded-panel border border-line bg-card p-6 shadow-card">
      <p className="font-sans-w7 text-base font-bold text-ink">Standaardwachtwoord wijzigen</p>
      <p className="mt-1 text-sm text-ink-muted">
        Alleen jij ziet deze sectie. Dit wijzigt het wachtwoord voor <em>nieuw</em> aan te maken
        accounts — bestaande accounts houden hun huidige wachtwoord.
      </p>
      <form onSubmit={opslaan} className="mt-4 flex flex-col gap-2">
        <label htmlFor="nieuw-standaard-wachtwoord" className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Nieuw standaardwachtwoord
        </label>
        <div className="flex max-w-xs gap-2">
          <input
            id="nieuw-standaard-wachtwoord"
            type="password"
            required
            minLength={8}
            value={wachtwoord}
            onChange={(e) => setWachtwoord(e.target.value)}
            className="w-full rounded-control border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={bezig}
            className="rounded-control bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-dark disabled:cursor-wait disabled:opacity-60"
          >
            {bezig ? "Opslaan…" : "Opslaan"}
          </button>
        </div>
        {fout && <p className="text-xs text-orange">{fout}</p>}
        {opgeslagen && <p className="text-xs text-positive">Opgeslagen.</p>}
      </form>
    </div>
  );
}
