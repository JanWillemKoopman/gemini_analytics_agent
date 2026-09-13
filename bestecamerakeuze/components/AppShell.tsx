"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import Sidebar, { type DashboardView } from "@/components/Sidebar";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import Toast from "@/components/Toast";
import NieuweCampagneKnop from "@/components/NieuweCampagneKnop";
import NieuwBerichtZijbalk from "@/components/kennisacties/NieuwBerichtZijbalk";
import WeekwinnaarPopup from "@/components/scores/WeekwinnaarPopup";
import { IconPlus } from "@/components/icons";
import { useTeamData } from "@/lib/teamData";

type Props = {
  gebruikerEmail: string | null;
  profielNaam: string | null;
  profielAvatarUrl: string | null;
  liveCount: number;
  ingelogd: boolean;
  scores: React.ReactNode;
  kennisacties: React.ReactNode;
  campagnes: React.ReactNode;
  tijdlijn: React.ReactNode;
  campagnebeheer: React.ReactNode;
  socialAds: React.ReactNode;
  googleAds: React.ReactNode;
  organisch: React.ReactNode;
  accountOntwikkeling: React.ReactNode;
  koppeltabel: React.ReactNode;
  prikbord: React.ReactNode;
  chat: React.ReactNode;
  kennis: React.ReactNode;
  kosten: React.ReactNode;
  instellingen: React.ReactNode;
};

/** Tabbladen uit de sidebargroep "Campagnes" — hier blijft het ronde "+"-knopje zichtbaar. */
const CAMPAGNE_GROEP_VIEWS: DashboardView[] = ["campagnes", "tijdlijn", "campagnebeheer"];

/**
 * De tabbladen met de "+" voor een bericht: de twee teamtabbladen én de kanaalpagina's.
 *
 * De kanaalpagina's stonden er eerst niet bij, en dat was precies verkeerd om: het
 * dashboard bestaat om beeld → besluit → terugblik te dragen, en het beeld waarop je iets
 * ontdekt staat hier — een campagne waarvan de kosten per lead verdubbelen zie je op
 * Social ads, niet op het scorebord. Wie daarvoor eerst naar een ander tabblad moet,
 * legt het niet vast.
 */
const TEAM_VIEWS: DashboardView[] = [
  "scores",
  "kennisacties",
  "social-ads",
  "google-ads",
  "organisch",
  "account-ontwikkeling",
];

const TITLES: Record<DashboardView, { title: string; subtitle: string }> = {
  scores: {
    title: "Scores",
    subtitle: "Het teamdoel, de weekstand en de totaalstand van iedereen die vastlegt.",
  },
  kennisacties: {
    title: "Kennis en acties",
    subtitle:
      "Wat het team opviel, verwacht, besloot en oppakt — over alle campagnes heen.",
  },
  campagnes: {
    title: "Campagnes",
    subtitle: "In één overzicht de prestaties van al je actieve campagnes.",
  },
  tijdlijn: {
    title: "Tijdlijn",
    subtitle: "De looptijd van alle campagnes in één jaaroverzicht.",
  },
  campagnebeheer: {
    title: "Campagnebeheer",
    subtitle: "Campagnes toevoegen en alle velden bewerken — direct in sync met de sheet.",
  },
  "social-ads": {
    title: "Social ads",
    subtitle: "Betaalde campagnes op Meta en LinkedIn, tot op de losse advertentie.",
  },
  "google-ads": {
    title: "Google Ads",
    subtitle: "Search, Performance Max, Demand Gen en Display naast elkaar.",
  },
  organisch: {
    title: "Organisch",
    subtitle: "De onbetaalde posts op Facebook, Instagram en LinkedIn.",
  },
  "account-ontwikkeling": {
    title: "Account",
    subtitle: "Hoe de social media-accounts zich ontwikkelen: volgers, bereik en interactie.",
  },
  koppeltabel: {
    title: "Koppeltabel",
    subtitle: "Welke collega beheert welke campagne — de koppeling die de platforms niet leveren.",
  },
  prikbord: {
    title: "Prikbord",
    subtitle: "De grafieken die het team uit de chat heeft vastgepind.",
  },
  chat: {
    title: "Chatbot",
    subtitle: "Praat met je data in gewone taal",
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
  ingelogd,
  scores,
  kennisacties,
  campagnes,
  tijdlijn,
  campagnebeheer,
  socialAds,
  googleAds,
  organisch,
  accountOntwikkeling,
  koppeltabel,
  prikbord,
  chat,
  kennis,
  kosten,
  instellingen,
}: Props) {
  const [actief, setActief] = useState<DashboardView>("campagnes");

  /**
   * Welke tabbladen zijn ooit geopend?
   *
   * Alle panelen blijven gemount zodra ze één keer getoond zijn — dat is wat een half
   * getypte vraag en een gescrollde tabel bewaart bij het wisselen van tab. Maar een
   * paneel dat nog nooit open is geweest, hoort ook nog geen data op te halen: de vijf
   * Kanalen-panelen doen elk een eigen serveraanroep, en die vijf tegelijk afvuren bij
   * het laden van het dashboard zou iedereen laten betalen voor tabbladen die hij die
   * dag niet opent. Vandaar: pas monteren bij het eerste bezoek, daarna blijven staan.
   */
  const [bezocht, setBezocht] = useState<Set<DashboardView>>(
    () => new Set<DashboardView>(["campagnes"]),
  );

  function navigeer(view: DashboardView) {
    setActief(view);
    setBezocht((eerder) => (eerder.has(view) ? eerder : new Set(eerder).add(view)));
  }
  const { title, subtitle } = TITLES[actief];
  const { zijbalkOpen, openZijbalk, melding, wisMelding } = useTeamData();

  return (
    <div className="flex min-h-screen pagina-vlak">
      {/* Het oogje staat helemaal rechtsboven in het scherm en blijft daar op elk
          tabblad staan — het hoort bij het venster, niet bij één pagina. */}
      <ThemeSwitcher />

      {/* z-40: moet boven de sticky tabelkoppen (z-30/z-20/z-10 in CampaignTable/
          CampagneTijdlijn) uitkomen. Bij gelijke z-index wint DOM-volgorde, en de tabel
          staat ná de sidebar in de boom — zonder deze hogere waarde priemt de sticky
          "Campagne"-kolomkop dwars door de uitgeklapte sidebar heen. */}
      <div className="sticky top-0 z-40 h-screen w-[72px] shrink-0">
        <Sidebar
          actief={actief}
          onNavigate={navigeer}
          gebruikerEmail={gebruikerEmail}
          profielNaam={profielNaam}
          profielAvatarUrl={profielAvatarUrl}
        />
      </div>

      {/* pr-16: ruimte voor het vaste oogje rechtsboven, zodat de status-/updateknop
          in de PageHeader er niet onder verdwijnt. */}
      <main className="min-w-0 flex-1 py-6 pl-8 pr-16">
        {actief !== "chat" && (
          <PageHeader
            title={title}
            subtitle={subtitle}
            meta={actief === "campagnes" ? { liveCount } : undefined}
          />
        )}

        <div className="mt-6" role="tabpanel" hidden={actief !== "scores"}>
          {scores}
        </div>
        <div className="mt-6" role="tabpanel" hidden={actief !== "kennisacties"}>
          {kennisacties}
        </div>
        <div className="mt-6" role="tabpanel" hidden={actief !== "campagnes"}>
          {campagnes}
        </div>
        <div className="mt-6" role="tabpanel" hidden={actief !== "tijdlijn"}>
          {tijdlijn}
        </div>
        <div className="mt-6" role="tabpanel" hidden={actief !== "campagnebeheer"}>
          {campagnebeheer}
        </div>
        {/* De vijf Kanalen-panelen blijven net als de rest gemount, maar ze halen hun
            data pas op zodra ze voor het eerst getoond worden — zie useKanaalData. Een
            tabblad dat je nooit opent kost dus ook geen ophaalactie. */}
        <div className="mt-6" role="tabpanel" hidden={actief !== "social-ads"}>
          {bezocht.has("social-ads") ? socialAds : null}
        </div>
        <div className="mt-6" role="tabpanel" hidden={actief !== "google-ads"}>
          {bezocht.has("google-ads") ? googleAds : null}
        </div>
        <div className="mt-6" role="tabpanel" hidden={actief !== "organisch"}>
          {bezocht.has("organisch") ? organisch : null}
        </div>
        <div className="mt-6" role="tabpanel" hidden={actief !== "account-ontwikkeling"}>
          {bezocht.has("account-ontwikkeling") ? accountOntwikkeling : null}
        </div>
        <div className="mt-6" role="tabpanel" hidden={actief !== "koppeltabel"}>
          {bezocht.has("koppeltabel") ? koppeltabel : null}
        </div>
        <div className="mt-6" role="tabpanel" hidden={actief !== "prikbord"}>
          {prikbord}
        </div>
        <div role="tabpanel" hidden={actief !== "chat"}>
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
      </main>

      {/* Het ronde "+"-knopje rechtsonder: alleen op de tabbladen uit de sidebargroep
          "Campagnes" (Campagnes, Tijdlijn, Campagnebeheer), niet op Chatbot/Kosten/
          Instellingen — het hoort bij het beheren van campagnes, niet bij het hele dashboard. */}
      {CAMPAGNE_GROEP_VIEWS.includes(actief) && <NieuweCampagneKnop ingelogd={ingelogd} />}

      {/* Dezelfde plek, maar dan voor een bericht: op Scores, op Kennis en acties en op de
          kanaalpagina's, want een observatie leg je vast op het moment dat je hem doet. De
          zijbalk zelf hangt hier (en niet in één van de panelen) zodat alle tabbladen — en
          de nudge in het scorebord — dezelfde zijbalk openen. */}
      {TEAM_VIEWS.includes(actief) && (
        <button
          type="button"
          onClick={openZijbalk}
          aria-label="Bericht toevoegen"
          title="Bericht toevoegen"
          className="fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-on-primary opacity-85 shadow-dropdown transition-opacity duration-[var(--duur-snel)] ease-merk hover:opacity-100"
        >
          <IconPlus className="h-5 w-5" />
        </button>
      )}

      {zijbalkOpen && <NieuwBerichtZijbalk />}

      {/* Beide renderen via een portal naar <body>, dus ze staan los van het actieve
          tabblad: de weekuitslag hoort maandagochtend te verschijnen waar je ook bent, en
          de puntenbevestiging hoort te blijven staan als de zijbalk dichtgaat. */}
      <WeekwinnaarPopup />
      <Toast melding={melding} onWeg={wisMelding} />
    </div>
  );
}
