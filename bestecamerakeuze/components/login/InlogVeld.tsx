"use client";

import type { InputHTMLAttributes, ReactNode } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  /** Label boven het veld — klein en in kapitalen, zoals elk label in het dashboard. */
  label: string;
  /** Het icoon vóór het veld; hoort uit `components/icons.tsx` te komen. */
  icoon: ReactNode;
  /** Optioneel knopje ná het veld (het oogje bij het wachtwoord). */
  achtervoegsel?: ReactNode;
  /** Zet de rand in de foutkleur zonder de tekst erin te herhalen. */
  fout?: boolean;
};

/**
 * Eén invoerveld op het inlogscherm: label erboven, icoon links in het veld en
 * eventueel een knopje rechts erin.
 *
 * Bewust een eigen component en geen losse JSX per veld: de twee velden moeten tot op de
 * pixel hetzelfde zijn, en de focus-state (een rand in de primaire kleur plus een zachte
 * halo in diezelfde kleur) is precies het soort detail dat bij handwerk per veld gaat
 * schuiven. De halo staat op de omhullende `div` via `focus-within`, zodat hij ook het
 * icoon en het oogje omvat — een ring om alleen de `input` zou daar middendoor lopen.
 */
export default function InlogVeld({
  label,
  icoon,
  achtervoegsel,
  fout = false,
  id,
  ...input
}: Props) {
  return (
    <label htmlFor={id} className="flex flex-col gap-2">
      <span className="label-theme text-label text-ink-muted">{label}</span>
      <span
        className={`flex items-center gap-3 rounded-button border bg-card px-5 transition-[border-color,box-shadow] duration-[var(--duur-snel)] ease-merk focus-within:border-primary focus-within:shadow-[0_0_0_3px_var(--color-primary-light)] ${
          fout ? "border-orange" : "border-line"
        }`}
      >
        <span aria-hidden="true" className="shrink-0 text-ink-faint">
          {icoon}
        </span>
        <input
          id={id}
          {...input}
          className="min-w-0 grow bg-transparent py-3.5 text-ink outline-none placeholder:text-ink-faint"
        />
        {achtervoegsel}
      </span>
    </label>
  );
}
