import type { Campagne } from "@/lib/sheet";
import StatusIndicator from "@/components/StatusIndicator";
import { getBrandLogo } from "@/components/brandLogos";
import CampaignNotes from "@/components/CampaignNotes";

type Props = {
  campagne: Campagne;
  /** Alleen tonen als er ook echt iets is om de aantekeningen in op te slaan. */
  notitiesBeschikbaar: boolean;
  ingelogd: boolean;
};

/** Kolomkop van één campagne: naam als primaire informatie, merk + status als metadata. */
export default function CampaignHeader({ campagne, notitiesBeschikbaar, ingelogd }: Props) {
  const BrandLogo = campagne.merk ? getBrandLogo(campagne.merk) : null;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-start justify-between gap-1.5">
        <span className="block min-w-0 truncate text-cell font-semibold text-ink">{campagne.naam}</span>
        {notitiesBeschikbaar && (
          <CampaignNotes campagneNaam={campagne.naam} ingelogd={ingelogd} />
        )}
      </div>
      <span className="flex min-w-0 items-center gap-1.5">
        {campagne.merk &&
          (BrandLogo ? (
            <BrandLogo role="img" aria-label={campagne.merk} className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
          ) : (
            <span className="min-w-0 truncate text-xs text-ink-faint">{campagne.merk}</span>
          ))}
        <StatusIndicator status={campagne.status} />
      </span>
    </div>
  );
}
