"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Avatar from "@/components/Avatar";
import { IconChevronUpDown, IconCoin, IconLogout, IconSettings } from "@/components/icons";

type Props = {
  naam: string;
  email: string | null;
  avatarUrl: string | null;
  onKosten: () => void;
  onInstellingen: () => void;
};

/**
 * Gebruikersknop onderaan de sidebar: klikken opent een uitklapmenu dat naar boven
 * groeit (er is geen ruimte eronder) met snelkoppelingen naar Kosten, Instellingen en
 * Uitloggen. Het menu rendert via een portal naar <body> en positioneert zichzelf met
 * de bounding rect van de knop — anders wordt het geclipt door de sidebar's
 * `overflow-x-hidden` (nodig voor de hover-uitklapanimatie) zodra het breder is dan de
 * ingeklapte 72px-rail. Zie ook Modal.tsx voor hetzelfde patroon.
 */
export default function GebruikersMenu({ naam, email, avatarUrl, onKosten, onInstellingen }: Props) {
  const [open, setOpen] = useState(false);
  const [positie, setPositie] = useState<{ left: number; bottom: number } | null>(null);
  const knopRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (knopRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
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
  }, [open]);

  function toggleOpen() {
    if (!open && knopRef.current) {
      const rect = knopRef.current.getBoundingClientRect();
      setPositie({ left: rect.left, bottom: window.innerHeight - rect.top + 8 });
    }
    setOpen((v) => !v);
  }

  return (
    <>
      <button
        ref={knopRef}
        type="button"
        onClick={toggleOpen}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-control px-2 py-2 text-left transition-colors duration-[var(--duur-snel)] hover:bg-sidebar-hover"
      >
        <Avatar naam={naam} avatarUrl={avatarUrl} size={32} />
        <span className="min-w-0 max-w-0 flex-1 overflow-hidden opacity-0 transition-all duration-[var(--duur)] group-hover:max-w-[160px] group-hover:opacity-100">
          <span className="block truncate text-sm font-medium text-sidebar-ink">{naam}</span>
          <span className="block truncate text-xs text-sidebar-ink-muted">Udenhout</span>
        </span>
        <IconChevronUpDown className="hidden h-4 w-4 shrink-0 text-sidebar-ink-muted group-hover:block" />
      </button>

      {open &&
        positie &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Gebruikersmenu"
            className="fixed z-50 w-56 rounded-card border border-line bg-card p-1.5 shadow-dropdown"
            style={{ left: positie.left, bottom: positie.bottom }}
          >
            <div className="border-b border-line-soft px-2 pb-2 pt-1">
              <p className="truncate text-sm font-medium text-ink">{naam}</p>
              {email && <p className="truncate text-xs text-ink-faint">{email}</p>}
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onKosten();
              }}
              className="mt-1 flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-sm text-ink transition-colors duration-[var(--duur-snel)] hover:bg-surface"
            >
              <IconCoin className="h-4 w-4 text-ink-faint" />
              Kosten
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onInstellingen();
              }}
              className="flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-sm text-ink transition-colors duration-[var(--duur-snel)] hover:bg-surface"
            >
              <IconSettings className="h-4 w-4 text-ink-faint" />
              Instellingen
            </button>
            <div className="my-1 border-t border-line-soft" />
            {email ? (
              // POST i.p.v. GET, zodat een prefetch of linkscanner je niet per ongeluk
              // uitlogt — zie app/auth/signout/route.ts.
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-sm text-ink transition-colors duration-[var(--duur-snel)] hover:bg-surface"
                >
                  <IconLogout className="h-4 w-4 text-ink-faint" />
                  Uitloggen
                </button>
              </form>
            ) : (
              <a
                href="/login"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-sm text-ink transition-colors duration-[var(--duur-snel)] hover:bg-surface"
              >
                <IconLogout className="h-4 w-4 text-ink-faint" />
                Inloggen
              </a>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
