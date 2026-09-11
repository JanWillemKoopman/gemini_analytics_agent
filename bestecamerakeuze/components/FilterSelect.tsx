"use client";

import { useEffect, useRef, useState } from "react";
import { IconChevronDown } from "@/components/icons";

type Props = {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
};

/**
 * Eén filtercontrol in de filterbalk: label klein erboven, waarde eronder, chevron
 * ernaast — zoals de referentie. De onderliggende selectie blijft multi-select
 * (checkboxes in het paneel); de knop zelf toont gewoon "Alle" of het aantal
 * geselecteerd, in plaats van vijf losse pill-buttons.
 */
export default function FilterSelect({ label, options, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  const valueLabel =
    selected.length === 0
      ? "Alle"
      : selected.length === 1
        ? selected[0]
        : `${selected.length} geselecteerd`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex min-w-[128px] flex-col items-start gap-0.5 rounded-control px-3 py-1.5 text-left transition-colors duration-[var(--duur-snel)] hover:bg-surface"
      >
        <span className="label-theme text-label text-ink-faint">{label}</span>
        <span className="flex items-center gap-1 text-sm font-medium text-ink">
          <span className="max-w-32 truncate">{valueLabel}</span>
          <IconChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-ink-faint transition-transform duration-[var(--duur-snel)] ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={label}
          aria-multiselectable="true"
          className="absolute left-0 z-40 mt-1 max-h-72 w-56 overflow-y-auto rounded-card border border-line bg-card p-1.5 shadow-dropdown"
        >
          {options.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-ink-faint">Geen opties</p>
          ) : (
            <>
              {selected.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="mb-1 block w-full rounded-control px-2 py-1 text-left text-xs font-medium text-primary hover:bg-primary-light"
                >
                  Wis selectie
                </button>
              )}
              {options.map((option) => (
                <label
                  key={option}
                  className="flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-sm text-ink hover:bg-surface"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(option)}
                    onChange={() => toggle(option)}
                    className="h-3.5 w-3.5 shrink-0 rounded border-line"
                  />
                  <span className="truncate">{option}</span>
                </label>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
