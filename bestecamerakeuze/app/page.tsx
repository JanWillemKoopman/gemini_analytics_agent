import AppShell from "@/components/AppShell";
import CampaignDashboard from "@/components/CampaignDashboard";
import CampagneBeheer from "@/components/beheer/CampagneBeheer";
import ChatPaneel from "@/components/chat/ChatPaneel";
import InstellingenPaneel from "@/components/instellingen/InstellingenPaneel";
import KennisEnActies from "@/components/kennisacties/KennisEnActies";
import KennisPaneel from "@/components/kennis/KennisPaneel";
import KostenPaneel from "@/components/kosten/KostenPaneel";
import NietGeconfigureerd from "@/components/NietGeconfigureerd";
import PrikbordPaneel from "@/components/prikbord/PrikbordPaneel";
import CampagneTijdlijn from "@/components/tijdlijn/CampagneTijdlijn";
import { getCampagnes } from "@/lib/sheet";
import { getGebruiker } from "@/lib/auth";
import { CampagneFilterProvider } from "@/lib/campagneFilterContext";
import { chatGereedheid, isSupabaseGeconfigureerd } from "@/lib/config";
import { formatUpdatedAt, isCampagneLive } from "@/lib/format";
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
  const updatedAt = formatUpdatedAt(new Date());

  return (
    <CampagneFilterProvider campagnes={campagnes}>
      <AppShell
        gebruikerEmail={gebruiker?.email ?? null}
        profielNaam={profiel?.naam ?? null}
        profielAvatarUrl={profiel?.avatarUrl ?? null}
        liveCount={liveCount}
        updatedAt={updatedAt}
        ingelogd={ingelogd}
        kennisacties={
          <KennisEnActies
            ingelogd={ingelogd}
            eigenNaam={profiel?.naam ?? null}
            eigenAvatarUrl={profiel?.avatarUrl ?? null}
          />
        }
        campagnes={
          <CampaignDashboard notitiesBeschikbaar={isSupabaseGeconfigureerd()} ingelogd={ingelogd} />
        }
        tijdlijn={<CampagneTijdlijn />}
        campagnebeheer={<CampagneBeheer ingelogd={ingelogd} />}
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
    </CampagneFilterProvider>
  );
}
