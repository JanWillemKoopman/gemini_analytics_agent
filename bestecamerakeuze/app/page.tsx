import AppShell from "@/components/AppShell";
import CampaignDashboard from "@/components/CampaignDashboard";
import CampagneBeheer from "@/components/beheer/CampagneBeheer";
import FacebookPaneel from "@/components/social/FacebookPaneel";
import ChatPaneel from "@/components/chat/ChatPaneel";
import InstellingenPaneel from "@/components/instellingen/InstellingenPaneel";
import KennisEnActies from "@/components/kennisacties/KennisEnActies";
import ScorePaneel from "@/components/scores/ScorePaneel";
import KennisPaneel from "@/components/kennis/KennisPaneel";
import KostenPaneel from "@/components/kosten/KostenPaneel";
import NietGeconfigureerd from "@/components/NietGeconfigureerd";
import PrikbordPaneel from "@/components/prikbord/PrikbordPaneel";
import CampagneTijdlijn from "@/components/tijdlijn/CampagneTijdlijn";
import { getCampagnes } from "@/lib/sheet";
import { getGebruiker } from "@/lib/auth";
import { CampagneFilterProvider } from "@/lib/campagneFilterContext";
import { chatGereedheid, isSupabaseGeconfigureerd, isWindsorGeconfigureerd } from "@/lib/config";
import { TeamDataProvider } from "@/lib/teamData";
import { isCampagneLive } from "@/lib/format";
import { haalProfiel } from "@/lib/profielen";
import { createClient } from "@/lib/supabase/server";

// De sheet kan buiten deze app om wijzigen, dus geen statische generatie: elke
// requestie haalt de actuele data op.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const campagnes = await getCampagnes();
  const gereed = chatGereedheid();
  // getGebruiker() checkt zelf al of Supabase geconfigureerd is en geeft anders null
  // terug — losgekoppeld van chatGereedheid(), want de aantekeningen bij de campagnes
  // hebben alleen Supabase nodig, niet de dataverbinding of de Claude-sleutel.
  const gebruiker = await getGebruiker();
  const ingelogd = Boolean(gebruiker);

  const profiel = gebruiker
    ? await haalProfiel(await createClient(), gebruiker.id).catch(() => null)
    : null;

  const liveCount = campagnes.filter((c) => isCampagneLive(c)).length;

  return (
    <CampagneFilterProvider campagnes={campagnes}>
      {/* Eén ophaalactie voor alles wat het team zelf vastlegt, gedeeld door de
          tabbladen Scores en Kennis en acties (en door de weekwinnaar-pop-up in
          AppShell) — zie lib/teamData.tsx. */}
      <TeamDataProvider
        ingelogd={ingelogd}
        eigenId={gebruiker?.id ?? null}
        eigenNaam={profiel?.naam ?? null}
        eigenAvatarUrl={profiel?.avatarUrl ?? null}
      >
        <AppShell
        gebruikerEmail={gebruiker?.email ?? null}
        profielNaam={profiel?.naam ?? null}
        profielAvatarUrl={profiel?.avatarUrl ?? null}
        liveCount={liveCount}
        ingelogd={ingelogd}
        scores={<ScorePaneel />}
        kennisacties={<KennisEnActies />}
        campagnes={
          <CampaignDashboard notitiesBeschikbaar={isSupabaseGeconfigureerd()} ingelogd={ingelogd} />
        }
        tijdlijn={<CampagneTijdlijn />}
        campagnebeheer={<CampagneBeheer ingelogd={ingelogd} />}
        facebook={
          isWindsorGeconfigureerd() ? (
            <FacebookPaneel ingelogd={ingelogd} />
          ) : (
            <NietGeconfigureerd
              titel="De social-mediacijfers zijn nog niet aangesloten"
              inleiding="Het tabblad is gebouwd en leest de Facebook-accounts via de datafeed van Windsor.ai. Er ontbreekt nog één omgevingsvariabele:"
              ontbreekt={[
                "WINDSOR_API_KEY — de API-sleutel uit Windsor.ai (Destinations → Python/R Code); server-only, dus zonder NEXT_PUBLIC_",
              ]}
              documentatie="bestecamerakeuze/README-social.md"
            />
          )
        }
        prikbord={
          gereed.gereed ? (
            <PrikbordPaneel ingelogd={ingelogd} />
          ) : (
            <NietGeconfigureerd ontbreekt={gereed.ontbreekt} />
          )
        }
        chat={
          gereed.gereed ? (
            <ChatPaneel ingelogd={ingelogd} />
          ) : (
            <NietGeconfigureerd ontbreekt={gereed.ontbreekt} />
          )
        }
        kennis={
          gereed.gereed ? (
            <KennisPaneel ingelogd={ingelogd} />
          ) : (
            <NietGeconfigureerd ontbreekt={gereed.ontbreekt} />
          )
        }
        kosten={
          gereed.gereed ? (
            <KostenPaneel ingelogd={ingelogd} />
          ) : (
            <NietGeconfigureerd ontbreekt={gereed.ontbreekt} />
          )
        }
        instellingen={<InstellingenPaneel ingelogd={ingelogd} email={gebruiker?.email ?? null} />}
        />
      </TeamDataProvider>
    </CampagneFilterProvider>
  );
}
