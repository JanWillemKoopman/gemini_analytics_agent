import type { Campagne } from "@/lib/sheet";
import StatusIndicator from "@/components/StatusIndicator";
import { getBrandLogo } from "@/components/brandLogos";
import CampaignNotes from "@/components/CampaignNotes";
import { isCampagneLive } from "@/lib/format";

type Props = {
  campagne: Campagne;
  /** Alleen tonen als er ook echt iets is om het logboek in op te slaan. */
  notitiesBeschikbaar: boolean;
  ingelogd: boolean;
  gefocust: boolean;
  /** Klikken op de naam zet de focus op deze campagne, of haalt hem er weer af. */
  onFocus: () => void;
};

/** Kolomkop van één campagne: naam als primaire informatie, merk + status als metadata. */
export default function CampaignHeader({
  campagne,
  notitiesBeschikbaar,
  ingelogd,
  gefocust,
  onFocus,
}: Props) {
  const BrandLogo = campagne.merk ? getBrandLogo(campagne.merk) : null;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-start justify-between gap-1.5">
        {/* De naam is de knop naar de focusmodus: het overleg gaat per campagne, dus
            één klik op de campagne waar het over gaat zet de rest op de achtergrond. */}
        <button
          type="button"
          onClick={onFocus}
          title={gefocust ? "Focus verlaten" : `Focus op ${campagne.naam}`}
          aria-pressed={gefocust}
          className={`block min-w-0 truncate text-left text-cell font-semibold transition-colors ${
            gefocust ? "text-primary" : "text-ink hover:text-primary"
          }`}
        >
          {campagne.naam}
        </button>
        {notitiesBeschikbaar && <CampaignNotes campagne={campagne} ingelogd={ingelogd} />}
      </div>
      <span className="flex min-w-0 items-center gap-1.5">
        {campagne.merk &&
          (BrandLogo ? (
            <BrandLogo role="img" aria-label={campagne.merk} className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
          ) : (
            <span className="min-w-0 truncate text-xs text-ink-faint">{campagne.merk}</span>
          ))}
        <StatusIndicator live={isCampagneLive(campagne)} />
      </span>
    </div>
  );
}
