type Props = {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
};

/**
 * Eén rij in de sidebar-navigatie; actief = subtiele lichte surface, geen felle kleur.
 *
 * Hoe die actieve staat eruitziet verschilt per merk (zie `.nav-item` in globals.css):
 * een volle pil bij Volkswagen en Audi, een strakke koperen streep links bij CUPRA,
 * een rode bij Porsche, een gouden haarlijn bij Bentley. Het vlak zelf blijft overal
 * hetzelfde token, alleen de vorm en de streep verschillen.
 */
export default function NavigationItem({ icon, label, active, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`nav-item relative flex w-full items-center gap-3 px-3 py-2 text-left text-sm font-medium transition-colors duration-[var(--duur-snel)] ease-merk ${
        active
          ? "nav-item-actief bg-sidebar-active text-sidebar-ink"
          : "text-sidebar-ink-muted hover:bg-sidebar-hover hover:text-sidebar-ink"
      }`}
    >
      <span className="shrink-0 [&>svg]:h-[18px] [&>svg]:w-[18px]">{icon}</span>
      {/* Ingeklapt (rail op 72px) is er geen ruimte voor tekst — de breedte + transparantie
          animeren mee met het uitklappen van de sidebar (zie Sidebar.tsx, group-hover). */}
      <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-[var(--duur)] ease-merk group-hover:max-w-[160px] group-hover:opacity-100">
        {label}
      </span>
    </button>
  );
}
