"use client";

import dynamic from "next/dynamic";

/** Laadt de kennisbank pas bij gebruik, net als het chatpaneel. */
const Kennisbank = dynamic(() => import("@/components/kennis/Kennisbank"), {
  ssr: false,
  loading: () => (
    <div className="laadvlak h-64 rounded-panel border border-line bg-surface" />
  ),
});

export default function KennisPaneel({ ingelogd }: { ingelogd: boolean }) {
  return <Kennisbank ingelogd={ingelogd} />;
}
