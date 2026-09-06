type Props = {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
};

/** Eén rij in de sidebar-navigatie; actief = subtiele lichte surface, geen felle kleur. */
export default function NavigationItem({ icon, label, active, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex w-full items-center gap-3 rounded-control px-3 py-2 text-left text-sm font-medium transition-colors duration-150 ${
        active
          ? "bg-sidebar-active text-sidebar-ink"
          : "text-sidebar-ink-muted hover:bg-sidebar-hover hover:text-sidebar-ink"
      }`}
    >
      <span className="shrink-0 [&>svg]:h-[18px] [&>svg]:w-[18px]">{icon}</span>
      {/* Ingeklapt (rail op 72px) is er geen ruimte voor tekst — de breedte + transparantie
          animeren mee met het uitklappen van de sidebar (zie Sidebar.tsx, group-hover). */}
      <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover:max-w-[160px] group-hover:opacity-100">
        {label}
      </span>
    </button>
  );
}
