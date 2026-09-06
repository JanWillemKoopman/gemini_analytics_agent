"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { createClient } from "@/lib/supabase/client";

/**
 * Inloggen met e-mailadres + wachtwoord.
 *
 * Geen magic link meer: accounts worden centraal aangemaakt (via Supabase of via het
 * `gebruiker:maak`-script, zie README-dataloket.md) met een wachtwoord dat direct aan
 * de collega wordt gegeven — er hoeft dus niemand eerst zelf een link uit zijn mail te
 * halen.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
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
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-16">
      <ThemeSwitcher />
      <h1 className="titel-theme text-ink">Inloggen</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Log in met het e-mailadres en wachtwoord die je van Udenhout hebt gekregen.
      </p>

      <form onSubmit={inloggen} className="mt-6 flex flex-col gap-3">
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voornaam@udenhout.nl"
          className="rounded-button border border-line bg-card px-5 py-3 text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          value={wachtwoord}
          onChange={(e) => setWachtwoord(e.target.value)}
          placeholder="Wachtwoord"
          className="rounded-button border border-line bg-card px-5 py-3 text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={bezig}
          className="rounded-button bg-primary px-6 py-3 font-medium text-on-primary transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          {bezig ? "Inloggen…" : "Inloggen"}
        </button>
        {fout && <p className="text-sm text-orange">{fout}</p>}
      </form>

      <p className="mt-5 text-sm text-ink-faint">
        Nog geen account? Vraag iemand met toegang tot Supabase om er een voor je aan te
        maken.
      </p>
    </main>
  );
}
