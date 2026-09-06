"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";

type Profiel = {
  id: string;
  naam: string | null;
  avatarUrl: string | null;
};

const MAX_BESTANDSGROOTTE = 4 * 1024 * 1024; // 4 MB — ruim genoeg voor een profielfoto

/**
 * Instellingen: eigen naam en avatarfoto. De foto gaat rechtstreeks vanuit de browser
 * naar Supabase Storage (bucket "avatars", rijbeveiligd op de eigen user-id als
 * mapnaam) — dat scheelt een aparte upload-route voor binaire bestanden. Naam en de
 * resulterende URL worden daarna via /api/profiel opgeslagen.
 */
export default function Instellingen({ ingelogd }: { ingelogd: boolean }) {
  const [profiel, setProfiel] = useState<Profiel | null>(null);
  const [naam, setNaam] = useState("");
  const [laden, setLaden] = useState(true);
  const [bezigMetOpslaan, setBezigMetOpslaan] = useState(false);
  const [bezigMetUploaden, setBezigMetUploaden] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [opgeslagen, setOpgeslagen] = useState(false);
  const bestandInputRef = useRef<HTMLInputElement>(null);

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
    <div className="max-w-lg rounded-panel border border-line bg-card p-6 shadow-card">
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
          <button
            type="button"
            onClick={() => bestandInputRef.current?.click()}
            disabled={bezigMetUploaden}
            className="rounded-control border border-line bg-card px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-surface disabled:cursor-wait disabled:opacity-60"
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
  );
}
