"use client";

import { useEffect, useRef, useState } from "react";
import Avatar from "@/components/Avatar";
import { IconEye, IconEyeOff, IconLock, IconPencil, IconPlus, IconTrash } from "@/components/icons";

interface GebruikerRij {
  id: string;
  email: string;
  aangemaaktOp: string;
  vergrendeld: boolean;
  // Alleen aanwezig in de response als de ingelogde gebruiker zelf beheerder is
  // (zie app/api/gebruikers/route.ts) — vandaar optioneel.
  naam?: string | null;
  avatarUrl?: string | null;
  wachtwoord?: string | null;
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
 * jkoopman@udenhout.nl zijn vergrendeld (niet verwijderbaar). Diezelfde twee accounts
 * (isBeheerder) zien bovendien per collega naam, foto en wachtwoord, en kunnen die
 * bewerken — alles server-side afgedwongen in de /api/gebruikers-routes, niet alleen
 * hier. Alleen koopman.janwillem@gmail.com ziet daarnaast de sectie om het gedeelde
 * standaardwachtwoord voor nieuwe accounts te wijzigen.
 */
export default function GebruikersBeheer({
  isWachtwoordEigenaar,
  isBeheerder,
}: {
  isWachtwoordEigenaar: boolean;
  isBeheerder: boolean;
}) {
  const [gebruikers, setGebruikers] = useState<GebruikerRij[] | null>(null);
  const [laadFout, setLaadFout] = useState<string | null>(null);
  const [emailInvoer, setEmailInvoer] = useState("");
  const [bezigMetToevoegen, setBezigMetToevoegen] = useState(false);
  const [toevoegFout, setToevoegFout] = useState<string | null>(null);
  const [toevoegResultaat, setToevoegResultaat] = useState<string | null>(null);
  const [verwijderId, setVerwijderId] = useState<string | null>(null);
  const [bewerkId, setBewerkId] = useState<string | null>(null);

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
    <div className="flex flex-col gap-6">
      <div className="rounded-panel border border-line bg-card p-6 shadow-card">
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

      <div className="rounded-panel border border-line bg-card p-6 shadow-card">
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
              <li key={g.id} className="py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    {isBeheerder && <Avatar naam={g.naam ?? null} avatarUrl={g.avatarUrl ?? null} size={28} />}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-ink">
                          {isBeheerder && g.naam ? g.naam : g.email}
                        </span>
                        {g.vergrendeld && (
                          <IconLock className="h-3.5 w-3.5 flex-none text-ink-faint" aria-label="Vergrendeld" />
                        )}
                      </div>
                      <p className="text-xs text-ink-faint">
                        {isBeheerder && g.naam ? `${g.email} · ` : ""}sinds {datumLabel(g.aangemaaktOp)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-none items-center gap-2">
                    {isBeheerder && (
                      <button
                        type="button"
                        onClick={() => setBewerkId((huidig) => (huidig === g.id ? null : g.id))}
                        title="Naam, foto en wachtwoord bewerken"
                        className="inline-flex items-center gap-1.5 rounded-control border border-line bg-card px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface hover:text-ink"
                      >
                        <IconPencil className="h-3.5 w-3.5" />
                        {bewerkId === g.id ? "Sluiten" : "Bewerken"}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={g.vergrendeld || verwijderId === g.id}
                      onClick={() => void verwijderen(g)}
                      title={g.vergrendeld ? "Dit account is vergrendeld en kan niet verwijderd worden" : "Verwijderen"}
                      className="inline-flex items-center gap-1.5 rounded-control border border-line bg-card px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface hover:text-orange disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <IconTrash className="h-3.5 w-3.5" />
                      {verwijderId === g.id ? "Bezig…" : "Verwijderen"}
                    </button>
                  </div>
                </div>

                {isBeheerder && bewerkId === g.id && (
                  <GebruikerBewerken
                    rij={g}
                    onBijgewerkt={(bijgewerkt) =>
                      setGebruikers((prev) =>
                        prev?.map((r) => (r.id === bijgewerkt.id ? { ...r, ...bijgewerkt } : r)) ?? prev,
                      )
                    }
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {isWachtwoordEigenaar && <StandaardWachtwoordPaneel />}
    </div>
  );
}

/**
 * Uitklappaneel per collega, alleen voor een beheerder (isBeheerder): naam, foto en
 * wachtwoord bewerken. Het wachtwoord staat hier bewust gewoon leesbaar in het veld —
 * dat is precies het doel van deze sectie, in tegenstelling tot het eigen-wachtwoordveld
 * bij "Mijn profiel" (dat toont nooit het bestaande wachtwoord, alleen wat je net
 * intypt). Server-side afgedwongen op PATCH /api/gebruikers/[id], dit is puur UI.
 */
function GebruikerBewerken({
  rij,
  onBijgewerkt,
}: {
  rij: GebruikerRij;
  onBijgewerkt: (rij: Partial<GebruikerRij> & { id: string }) => void;
}) {
  const [naam, setNaam] = useState(rij.naam ?? "");
  const [wachtwoord, setWachtwoord] = useState(rij.wachtwoord ?? "");
  const [toonWachtwoord, setToonWachtwoord] = useState(false);
  const [bezigMetOpslaan, setBezigMetOpslaan] = useState(false);
  const [bezigMetUploaden, setBezigMetUploaden] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [opgeslagen, setOpgeslagen] = useState(false);
  const bestandInputRef = useRef<HTMLInputElement>(null);

  async function opslaan(e: React.FormEvent) {
    e.preventDefault();
    setBezigMetOpslaan(true);
    setFout(null);
    setOpgeslagen(false);
    try {
      const body: Record<string, string> = { naam: naam.trim() };
      if (wachtwoord && wachtwoord !== rij.wachtwoord) body.wachtwoord = wachtwoord;
      const res = await fetch(`/api/gebruikers/${rij.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.fout ?? "Kon gebruiker niet opslaan.");
      onBijgewerkt({ id: rij.id, naam: body.naam || null, wachtwoord: body.wachtwoord ?? rij.wachtwoord });
      setOpgeslagen(true);
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Kon gebruiker niet opslaan.");
    } finally {
      setBezigMetOpslaan(false);
    }
  }

  async function fotoUploaden(bestand: File) {
    setFout(null);
    setBezigMetUploaden(true);
    try {
      const formData = new FormData();
      formData.append("bestand", bestand);
      const res = await fetch(`/api/gebruikers/${rij.id}/avatar`, { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.fout ?? "Kon foto niet uploaden.");
      onBijgewerkt({ id: rij.id, avatarUrl: json.profiel.avatarUrl });
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Kon foto niet uploaden.");
    } finally {
      setBezigMetUploaden(false);
    }
  }

  return (
    <form
      onSubmit={opslaan}
      className="mt-3 flex flex-col gap-3 rounded-card border border-line bg-surface p-4"
    >
      <div className="flex items-center gap-3">
        <Avatar naam={naam || rij.email} avatarUrl={rij.avatarUrl ?? null} size={40} />
        <div>
          <button
            type="button"
            onClick={() => bestandInputRef.current?.click()}
            disabled={bezigMetUploaden}
            className="rounded-control border border-line bg-card px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface disabled:cursor-wait disabled:opacity-60"
          >
            {bezigMetUploaden ? "Uploaden…" : "Foto wijzigen"}
          </button>
          <input
            ref={bestandInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const bestand = e.target.files?.[0];
              if (bestand) void fotoUploaden(bestand);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={`naam-${rij.id}`} className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Naam
          </label>
          <input
            id={`naam-${rij.id}`}
            type="text"
            value={naam}
            onChange={(e) => setNaam(e.target.value)}
            placeholder="Voornaam Achternaam"
            className="w-48 rounded-control border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`wachtwoord-${rij.id}`} className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Wachtwoord
          </label>
          <div className="relative w-48">
            <input
              id={`wachtwoord-${rij.id}`}
              type={toonWachtwoord ? "text" : "password"}
              value={wachtwoord}
              onChange={(e) => setWachtwoord(e.target.value)}
              className="w-full rounded-control border border-line bg-card px-3 py-2 pr-9 text-sm text-ink focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setToonWachtwoord((v) => !v)}
              aria-label={toonWachtwoord ? "Wachtwoord verbergen" : "Wachtwoord weergeven"}
              className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-ink-faint transition-colors hover:text-ink"
            >
              {toonWachtwoord ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={bezigMetOpslaan}
          className="rounded-control bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-dark disabled:cursor-wait disabled:opacity-60"
        >
          {bezigMetOpslaan ? "Opslaan…" : "Opslaan"}
        </button>
      </div>

      {fout && <p className="text-xs text-orange">{fout}</p>}
      {opgeslagen && <p className="text-xs text-positive">Opgeslagen.</p>}
    </form>
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
    <div className="rounded-panel border border-line bg-card p-6 shadow-card">
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
