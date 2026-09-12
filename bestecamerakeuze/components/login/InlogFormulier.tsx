"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import InlogVeld from "@/components/login/InlogVeld";
import {
  IconArrowRight,
  IconEye,
  IconEyeOff,
  IconLock,
  IconMail,
} from "@/components/icons";
import { createClient } from "@/lib/supabase/client";

/**
 * Het inlogformulier zelf: e-mailadres + wachtwoord.
 *
 * Geen magic link en geen zelfregistratie — accounts worden centraal aangemaakt (via
 * Supabase of `scripts/maak-gebruiker.ts`, zie README-dataloket.md) met een wachtwoord
 * dat direct aan de collega wordt gegeven.
 */
export default function InlogFormulier() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [toonWachtwoord, setToonWachtwoord] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  async function inloggen(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !wachtwoord) return;
    setBezig(true);
    setFout(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: wachtwoord,
    });

    if (error) {
      setFout("E-mailadres of wachtwoord onjuist.");
      setBezig(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={inloggen} className="flex flex-col gap-5" noValidate>
      <InlogVeld
        id="inlog-email"
        label="E-mailadres"
        icoon={<IconMail className="h-[18px] w-[18px]" />}
        type="email"
        required
        autoComplete="email"
        autoFocus
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="voornaam@udenhout.nl"
        fout={Boolean(fout)}
      />

      <InlogVeld
        id="inlog-wachtwoord"
        label="Wachtwoord"
        icoon={<IconLock className="h-[18px] w-[18px]" />}
        type={toonWachtwoord ? "text" : "password"}
        required
        autoComplete="current-password"
        value={wachtwoord}
        onChange={(e) => setWachtwoord(e.target.value)}
        placeholder="••••••••"
        fout={Boolean(fout)}
        achtervoegsel={
          <button
            type="button"
            onClick={() => setToonWachtwoord((v) => !v)}
            aria-label={toonWachtwoord ? "Wachtwoord verbergen" : "Wachtwoord tonen"}
            title={toonWachtwoord ? "Wachtwoord verbergen" : "Wachtwoord tonen"}
            className="-mr-1 shrink-0 rounded-control p-1.5 text-ink-faint transition-colors duration-[var(--duur-snel)] ease-merk hover:text-ink"
          >
            {toonWachtwoord ? (
              <IconEyeOff className="h-[18px] w-[18px]" />
            ) : (
              <IconEye className="h-[18px] w-[18px]" />
            )}
          </button>
        }
      />

      {/* De foutmelding staat vast onder de velden en boven de knop: hij mag de knop
          niet verplaatsen op het moment dat je hem nog een keer wil indrukken. */}
      {fout && (
        <p
          role="alert"
          className="flex items-start gap-2.5 rounded-control border border-orange/30 bg-orange/5 px-4 py-3 text-sm text-ink"
        >
          <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-orange" />
          {fout}
        </p>
      )}

      <button
        type="submit"
        disabled={bezig}
        className="group mt-1 flex items-center justify-center gap-2.5 rounded-button bg-primary px-6 py-3.5 font-sans-w7 text-on-primary shadow-subtle transition-[background-color,box-shadow,transform] duration-[var(--duur-snel)] ease-merk hover:bg-primary-dark hover:shadow-raised disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
      >
        {bezig ? "Inloggen…" : "Inloggen"}
        <IconArrowRight className="h-[18px] w-[18px] transition-transform duration-[var(--duur-snel)] ease-merk group-hover:translate-x-0.5" />
      </button>
    </form>
  );
}
