import Avatar from "@/components/Avatar";
import LogoMark from "@/components/LogoMark";
import NavigationItem from "@/components/NavigationItem";
import {
  IconBook,
  IconCalendar,
  IconChat,
  IconChevronUpDown,
  IconCoin,
  IconMegaphone,
  IconPin,
  IconSettings,
  IconTable,
} from "@/components/icons";

export type DashboardView =
  | "campagnes"
  | "tijdlijn"
  | "campagnebeheer"
  | "prikbord"
  | "chat"
  | "kennis"
  | "kosten"
  | "instellingen";

type Props = {
  actief: DashboardView;
  onNavigate: (view: DashboardView) => void;
  gebruikerEmail: string | null;
  profielNaam: string | null;
  profielAvatarUrl: string | null;
};

/** Toon alleen het lokale deel van het werkadres als naam; het domein staat al in "Udenhout" eronder. */
function naamVoor(email: string | null): string {
  if (!email) return "Gast";
  return email.split("@")[0] || email;
}

/** De donkere navigatieschil links: branding, hoofdnavigatie en gebruikersprofiel. */
export default function Sidebar({
  actief,
  onNavigate,
  gebruikerEmail,
  profielNaam,
  profielAvatarUrl,
}: Props) {
  const weergavenaam = profielNaam || naamVoor(gebruikerEmail);

  return (
    // Staat standaard ingeklapt op een smalle icoon-rail (72px); bij hover klapt hij uit
    // tot 240px. De rail zelf reserveert de ruimte in AppShell (sticky, w-[72px]) en dit
    // element is daarbinnen absoluut gepositioneerd, zodat uitklappen over de content
    // heen valt in plaats van hem opzij te duwen — geen layoutshift op hover.
    <aside className="group absolute inset-y-0 left-0 flex w-[72px] flex-col justify-between overflow-x-hidden overflow-y-auto border-r border-sidebar-line bg-sidebar px-4 py-5 transition-[width] duration-200 ease-out hover:z-40 hover:w-[240px] hover:shadow-dropdown">
      <div>
        <div className="flex items-center gap-2.5 px-0.5">
          <LogoMark className="h-9 w-9 text-[13px]" />
          <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover:max-w-[160px] group-hover:opacity-100">
            <span className="block font-sans-w7 text-cell font-bold tracking-[0.04em] text-sidebar-ink">
              Udenhout
            </span>
            <span className="block text-label text-sidebar-ink-muted">AI-dataloket</span>
          </span>
        </div>

        <nav aria-label="Hoofdnavigatie" className="mt-6 flex flex-col gap-0.5">
          <p className="label-theme mb-1 hidden px-3 text-label text-sidebar-ink-muted group-hover:block">
            Campagnes
          </p>
          <NavigationItem
            icon={<IconMegaphone />}
            label="Campagnes"
            active={actief === "campagnes"}
            onClick={() => onNavigate("campagnes")}
          />
          <NavigationItem
            icon={<IconCalendar />}
            label="Tijdlijn"
            active={actief === "tijdlijn"}
            onClick={() => onNavigate("tijdlijn")}
          />
          <NavigationItem
            icon={<IconTable />}
            label="Campagnebeheer"
            active={actief === "campagnebeheer"}
            onClick={() => onNavigate("campagnebeheer")}
          />

          <p className="label-theme mb-1 mt-4 hidden px-3 text-label text-sidebar-ink-muted group-hover:block">
            Chatbot
          </p>
          <NavigationItem
            icon={<IconChat />}
            label="Start gesprek"
            active={actief === "chat"}
            onClick={() => onNavigate("chat")}
          />
          <NavigationItem
            icon={<IconPin />}
            label="Prikbord"
            active={actief === "prikbord"}
            onClick={() => onNavigate("prikbord")}
          />
          <NavigationItem
            icon={<IconBook />}
            label="Kennisbank"
            active={actief === "kennis"}
            onClick={() => onNavigate("kennis")}
          />
        </nav>
      </div>

      <div className="flex flex-col gap-0.5 border-t border-sidebar-line pt-3">
        <NavigationItem
          icon={<IconCoin />}
          label="Kosten"
          active={actief === "kosten"}
          onClick={() => onNavigate("kosten")}
        />
        <NavigationItem
          icon={<IconSettings />}
          label="Instellingen"
          active={actief === "instellingen"}
          onClick={() => onNavigate("instellingen")}
        />
        <button
          type="button"
          onClick={() => onNavigate("instellingen")}
          className="flex w-full items-center gap-2.5 rounded-control px-2 py-2 text-left transition-colors duration-150 hover:bg-sidebar-hover"
        >
          <Avatar naam={weergavenaam} avatarUrl={profielAvatarUrl} size={32} />
          <span className="min-w-0 max-w-0 flex-1 overflow-hidden opacity-0 transition-all duration-200 group-hover:max-w-[160px] group-hover:opacity-100">
            <span className="block truncate text-sm font-medium text-sidebar-ink">
              {weergavenaam}
            </span>
            <span className="block truncate text-xs text-sidebar-ink-muted">Udenhout</span>
          </span>
          <IconChevronUpDown className="hidden h-4 w-4 shrink-0 text-sidebar-ink-muted group-hover:block" />
        </button>
      </div>
    </aside>
  );
}
