"use client";

import { useState } from "react";
import FooterNote from "@/components/FooterNote";
import PageHeader from "@/components/PageHeader";
import Sidebar, { type DashboardView } from "@/components/Sidebar";
import ThemeSwitcher from "@/components/ThemeSwitcher";

type Props = {
  gebruikerEmail: string | null;
  profielNaam: string | null;
  profielAvatarUrl: string | null;
  liveCount: number;
  updatedAt: string;
  campagnes: React.ReactNode;
  chat: React.ReactNode;
  kennis: React.ReactNode;
  kosten: React.ReactNode;
  instellingen: React.ReactNode;
};

const TITLES: Record<DashboardView, { title: string; subtitle: string }> = {
  campagnes: {
    title: "Campagnes",
    subtitle: "In één overzicht de prestaties van al je actieve campagnes.",
  },
  chat: {
    title: "Start gesprek",
    subtitle: "Stel een vraag in gewone taal en krijg antwoord uit je eigen data.",
  },
  kennis: {
    title: "Kennisbank",
    subtitle: "Alles wat je moet weten om campagnes en data goed te interpreteren.",
  },
  kosten: {
    title: "Kosten",
    subtitle: "Claude API-uitgaven per dag.",
  },
  instellingen: {
    title: "Instellingen",
    subtitle: "Je naam en profielfoto, zichtbaar voor collega's.",
  },
};

/**
 * De navigatieschil rond het hele dashboard: sidebar links, page header + content
 * rechts. Alle panelen blijven gemount (verborgen via CSS) zodat een half getypte
 * vraag of een gespreksgeschiedenis niet verdwijnt bij het wisselen van tab, en zodat
 * de campagnetabel niet opnieuw hoeft te laden.
 *
 * Uitsluitend voor desktop gebouwd (zie CLAUDE.md) — de sidebar staat altijd vast, geen
 * mobiel menu nodig.
 */
export default function AppShell({
  gebruikerEmail,
  profielNaam,
  profielAvatarUrl,
  liveCount,
  updatedAt,
  campagnes,
  chat,
  kennis,
  kosten,
  instellingen,
}: Props) {
  const [actief, setActief] = useState<DashboardView>("campagnes");
  const { title, subtitle } = TITLES[actief];

  return (
    <div className="flex min-h-screen bg-page">
      {/* Het oogje staat helemaal rechtsboven in het scherm en blijft daar op elk
          tabblad staan — het hoort bij het venster, niet bij één pagina. */}
      <ThemeSwitcher />

      <div className="sticky top-0 z-30 h-screen w-[72px] shrink-0">
        <Sidebar
          actief={actief}
          onNavigate={setActief}
          gebruikerEmail={gebruikerEmail}
          profielNaam={profielNaam}
          profielAvatarUrl={profielAvatarUrl}
        />
      </div>

      {/* pr-16: ruimte voor het vaste oogje rechtsboven, zodat de status-/updateknop
          in de PageHeader er niet onder verdwijnt. */}
      <main className="min-w-0 flex-1 py-6 pl-8 pr-16">
        <PageHeader
          title={title}
          subtitle={subtitle}
          meta={actief === "campagnes" ? { liveCount, updatedAt } : undefined}
        />

        <div className="mt-6" role="tabpanel" hidden={actief !== "campagnes"}>
          {campagnes}
        </div>
        <div className="mt-6" role="tabpanel" hidden={actief !== "chat"}>
          {chat}
        </div>
        <div className="mt-6" role="tabpanel" hidden={actief !== "kennis"}>
          {kennis}
        </div>
        <div className="mt-6" role="tabpanel" hidden={actief !== "kosten"}>
          {kosten}
        </div>
        <div className="mt-6" role="tabpanel" hidden={actief !== "instellingen"}>
          {instellingen}
        </div>

        <FooterNote />
      </main>
    </div>
  );
}
