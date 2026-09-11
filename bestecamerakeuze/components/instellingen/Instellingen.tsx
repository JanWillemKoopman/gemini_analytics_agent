"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import { IconEye, IconEyeOff } from "@/components/icons";
import GebruikersBeheer from "@/components/instellingen/GebruikersBeheer";
import { isWachtwoordEigenaar } from "@/lib/gebruikersbeheer";

type Profiel = {
  id: string;
  naam: string | null;
  avatarUrl: string | null;
};

const MAX_BESTANDSGROOTTE = 4 * 1024 * 1024; // 4 MB — ruim genoeg voor een profielfoto
const MIN_WACHTWOORD_LENGTE = 6; // zelfde ondergrens als Supabase Auth zelf hanteert

/**
 * Instellingen: eigen naam, avatarfoto, e-mailadres (alleen ter info) en wachtwoord. De
 * foto gaat rechtstreeks vanuit de browser naar Supabase Storage (bucket "avatars",
 * rijbeveiligd op de eigen user-id als mapnaam) — dat scheelt een aparte upload-route
 * voor binaire bestanden. Naam en de resulterende URL worden daarna via /api/profiel
 * opgeslagen. Het wachtwoord zelf wordt nergens leesbaar opgeslagen (Supabase Auth
 * bewaart alleen een hash) — "wachtwoord weergeven" is dus een nieuw wachtwoord kunnen
 * intypen mét een oogje om te controleren wat je typt, niet het bestaande wachtwoord
 * kunnen terugzien.
 */
export default function Instellingen({
  ingelogd,
  email,
}: {
  ingelogd: boolean;
  email: string | null;
}) {
  const [profiel, setProfiel] = useState<Profiel | null>(null);
  const [naam, setNaam] = useState("");
  const [laden, setLaden] = useState(true);
  const [bezigMetOpslaan, setBezigMetOpslaan] = useState(false);
  const [bezigMetUploaden, setBezigMetUploaden] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [opgeslagen, setOpgeslagen] = useState(false);
  const bestandInputRef = useRef<HTMLInputElement>(null);

  const [nieuwWachtwoord, setNieuwWachtwoord] = useState("");
  const [bevestigWachtwoord, setBevestigWachtwoord] = useState("");
  const [toonWachtwoord, setToonWachtwoord] = useState(false);
  const [bezigMetWachtwoord, setBezigMetWachtwoord] = useState(false);
  const [wachtwoordFout, setWachtwoordFout] = useState<string | null>(null);
  const [wachtwoordOpgeslagen, setWachtwoordOpgeslagen] = useState(false);

  useEffect(() => {
    if (!ingelogd) {
      setLaden(false);
      return;
    }
    let genegeerd = false;
    fetch("/api/profiel")
      .then((res) => res.json())
      .then((json) => {
        if (genegeerd) return;
        if (json.fout) throw new Error(json.fout);
        setProfiel(json.profiel);
        setNaam(json.profiel.naam ?? "");
      })
      .catch((err) => {
        if (!genegeerd) setFout(err instanceof Error ? err.message : "Kon profiel niet ophalen.");
      })
      .finally(() => {
        if (!genegeerd) setLaden(false);
      });
    return () => {
      genegeerd = true;
    };
  }, [ingelogd]);

  async function naamOpslaan(e: React.FormEvent) {
    e.preventDefault();
    setBezigMetOpslaan(true);
    setFout(null);
    setOpgeslagen(false);
    try {
      const res = await fetch("/api/profiel", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ naam: naam.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.fout ?? "Kon naam niet opslaan.");
      setProfiel(json.profiel);
      setOpgeslagen(true);
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Kon naam niet opslaan.");
    } finally {
      setBezigMetOpslaan(false);
    }
  }

  async function avatarUploaden(bestand: File) {
    setFout(null);
    if (!bestand.type.startsWith("image/")) {
      setFout("Kies een afbeelding (JPG, PNG of WebP).");
      return;
    }
    if (bestand.size > MAX_BESTANDSGROOTTE) {
      setFout("De afbeelding mag maximaal 4 MB zijn.");
      return;
    }

    setBezigMetUploaden(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Log eerst in.");

      const extensie = bestand.name.split(".").pop()?.toLowerCase() || "jpg";
      const pad = `${user.id}/avatar.${extensie}`;

      const { error: uploadFout } = await supabase.storage
        .from("avatars")
        .upload(pad, bestand, { upsert: true, cacheControl: "3600" });
      if (uploadFout) throw new Error(uploadFout.message);

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(pad);
      // Cache-buster, anders blijft de browser (en elke andere kijker) de oude foto
      // tonen — de bestandsnaam zelf verandert niet bij upsert.
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      const res = await fetch("/api/profiel", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.fout ?? "Kon avatar niet opslaan.");
      setProfiel(json.profiel);
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Kon avatar niet uploaden.");
    } finally {
      setBezigMetUploaden(false);
    }
  }

  async function avatarVerwijderen() {
    setFout(null);
    setBezigMetUploaden(true);
    try {
      const res = await fetch("/api/profiel", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.fout ?? "Kon foto niet verwijderen.");
      setProfiel(json.profiel);
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Kon foto niet verwijderen.");
    } finally {
      setBezigMetUploaden(false);
    }
  }

  async function wachtwoordOpslaan(e: React.FormEvent) {
    e.preventDefault();
    setWachtwoordFout(null);
    setWachtwoordOpgeslagen(false);

    if (nieuwWachtwoord.length < MIN_WACHTWOORD_LENGTE) {
      setWachtwoordFout(`Wachtwoord moet minimaal ${MIN_WACHTWOORD_LENGTE} tekens zijn.`);
      return;
    }
    if (nieuwWachtwoord !== bevestigWachtwoord) {
      setWachtwoordFout("Wachtwoorden komen niet overeen.");
      return;
    }

    setBezigMetWachtwoord(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: nieuwWachtwoord });
      if (error) throw new Error(error.message);
      setNieuwWachtwoord("");
      setBevestigWachtwoord("");
      setWachtwoordOpgeslagen(true);
    } catch (err) {
      setWachtwoordFout(err instanceof Error ? err.message : "Kon wachtwoord niet wijzigen.");
    } finally {
      setBezigMetWachtwoord(false);
    }
  }

  if (!ingelogd) {
    return (
      <div className="rounded-panel border border-line bg-surface p-8 text-center">
        <p className="font-sans-w7 text-lg font-bold text-ink">Log in om je profiel te beheren</p>
        <p className="mt-2 text-sm text-ink-muted">
          Je naam en profielfoto zijn zichtbaar voor collega&apos;s, bijvoorbeeld bij
          aantekeningen die je toevoegt.
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

  if (laden) {
    return (
      <div className="rounded-panel border border-line bg-card p-6 shadow-card">
        <p className="text-sm text-ink-faint">Laden…</p>
      </div>
    );
  }

  return (
    <div className="grid max-w-6xl grid-cols-2 items-start gap-8">
    <div className="flex flex-col gap-6">
    <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Mijn profiel</p>
    <div className="rounded-panel border border-line bg-card p-6 shadow-card">
      <p className="font-sans-w7 text-base font-bold text-ink">Profiel</p>
      <p className="mt-1 text-sm text-ink-muted">
        Je naam en foto zijn zichtbaar voor collega&apos;s, onder andere bij
        aantekeningen die je toevoegt aan een campagne.
      </p>

      {fout && (
        <p className="mt-4 rounded-card border border-orange bg-card px-3 py-2 text-xs text-orange">
          {fout}
        </p>
      )}

      <div className="mt-5 flex items-center gap-4">
        <Avatar naam={profiel?.naam ?? null} avatarUrl={profiel?.avatarUrl ?? null} size={64} />
        <div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => bestandInputRef.current?.click()}
              disabled={bezigMetUploaden}
              className="rounded-control border border-line bg-card px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-surface disabled:cursor-wait disabled:opacity-60"
            >
              {bezigMetUploaden ? "Uploaden…" : "Foto wijzigen"}
            </button>
            {profiel?.avatarUrl && (
              <button
                type="button"
                onClick={() => void avatarVerwijderen()}
                disabled={bezigMetUploaden}
                className="rounded-control border border-line bg-card px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface hover:text-orange disabled:cursor-wait disabled:opacity-60"
              >
                Verwijderen
              </button>
            )}
          </div>
          <input
            ref={bestandInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const bestand = e.target.files?.[0];
              if (bestand) void avatarUploaden(bestand);
              e.target.value = "";
            }}
          />
          <p className="mt-1.5 text-xs text-ink-faint">JPG, PNG of WebP, max 4 MB.</p>
        </div>
      </div>

      <form onSubmit={naamOpslaan} className="mt-6 flex flex-col gap-2">
        <label htmlFor="naam" className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Naam
        </label>
        <div className="flex gap-2">
          <input
            id="naam"
            type="text"
            value={naam}
            onChange={(e) => {
              setNaam(e.target.value);
              setOpgeslagen(false);
            }}
            placeholder="Voornaam Achternaam"
            className="w-full max-w-xs rounded-control border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={bezigMetOpslaan}
            className="rounded-control bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-dark disabled:cursor-wait disabled:opacity-60"
          >
            {bezigMetOpslaan ? "Opslaan…" : "Opslaan"}
          </button>
        </div>
        {opgeslagen && <p className="text-xs text-positive">Opgeslagen.</p>}
      </form>
    </div>

    <div className="rounded-panel border border-line bg-card p-6 shadow-card">
      <p className="font-sans-w7 text-base font-bold text-ink">Account</p>

      <div className="mt-5 flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
          E-mailadres
        </span>
        <p className="text-sm text-ink">{email ?? "—"}</p>
      </div>

      <form onSubmit={wachtwoordOpslaan} className="mt-6 flex flex-col gap-2">
        <label
          htmlFor="nieuw-wachtwoord"
          className="text-xs font-semibold uppercase tracking-wide text-ink-faint"
        >
          Nieuw wachtwoord
        </label>
        <div className="flex max-w-xs gap-2">
          <div className="relative w-full">
            <input
              id="nieuw-wachtwoord"
              type={toonWachtwoord ? "text" : "password"}
              value={nieuwWachtwoord}
              onChange={(e) => {
                setNieuwWachtwoord(e.target.value);
                setWachtwoordOpgeslagen(false);
              }}
              autoComplete="new-password"
              placeholder="Minimaal 6 tekens"
              className="w-full rounded-control border border-line bg-card px-3 py-2 pr-9 text-sm text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setToonWachtwoord((v) => !v)}
              aria-label={toonWachtwoord ? "Wachtwoord verbergen" : "Wachtwoord weergeven"}
              className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-ink-faint transition-colors hover:text-ink"
            >
              {toonWachtwoord ? (
                <IconEyeOff className="h-4 w-4" />
              ) : (
                <IconEye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <label
          htmlFor="bevestig-wachtwoord"
          className="mt-2 text-xs font-semibold uppercase tracking-wide text-ink-faint"
        >
          Bevestig wachtwoord
        </label>
        <div className="flex max-w-xs gap-2">
          <input
            id="bevestig-wachtwoord"
            type={toonWachtwoord ? "text" : "password"}
            value={bevestigWachtwoord}
            onChange={(e) => {
              setBevestigWachtwoord(e.target.value);
              setWachtwoordOpgeslagen(false);
            }}
            autoComplete="new-password"
            className="w-full rounded-control border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
          />
        </div>

        {wachtwoordFout && <p className="mt-1 text-xs text-orange">{wachtwoordFout}</p>}
        {wachtwoordOpgeslagen && (
          <p className="mt-1 text-xs text-positive">Wachtwoord gewijzigd.</p>
        )}

        <button
          type="submit"
          disabled={bezigMetWachtwoord || !nieuwWachtwoord}
          className="mt-2 self-start rounded-control bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-dark disabled:cursor-wait disabled:opacity-60"
        >
          {bezigMetWachtwoord ? "Opslaan…" : "Wachtwoord opslaan"}
        </button>
      </form>
    </div>
    </div>

    <div className="flex flex-col gap-6">
    <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Team</p>
    <GebruikersBeheer isWachtwoordEigenaar={isWachtwoordEigenaar(email)} />
    </div>
    </div>
  );
}
