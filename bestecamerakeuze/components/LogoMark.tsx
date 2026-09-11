"use client";

import { getBrandLogo } from "@/components/brandLogos";
import { IconCar } from "@/components/icons";
import { useTheme } from "@/components/ThemeProvider";

/**
 * Het merkteken bovenaan de sidebar. In de eigen huisstijl (Udenhout) is dat het
 * auto-icoon; staat het dashboard in de vormgeving van een automerk, dan staat daar het
 * merklogo zelf — het duidelijkste signaal dat je naar dat merk kijkt, en het scheelt
 * uitleg in het themamenu.
 *
 * De theme-id's zijn dezelfde namen als de sleutels in `brandLogos.tsx`, dus dit is één
 * opzoeking zonder eigen tabel. Voor een theme zonder logo in die set (Udenhout, CUPRA)
 * blijft het auto-icoon staan.
 */
export default function LogoMark({ className }: { className?: string }) {
  const { theme } = useTheme();
  const MerkLogo = getBrandLogo(theme);

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-control bg-logo text-on-logo ${className ?? ""}`}
    >
      {MerkLogo ? <MerkLogo className="h-[58%] w-[58%]" /> : <IconCar className="h-[60%] w-[60%]" />}
    </span>
  );
}
