"use client";

import dynamic from "next/dynamic";

/** Laadt het prikbord pas bij gebruik, net als de chat en de kennisbank. */
const Prikbord = dynamic(() => import("@/components/prikbord/Prikbord"), {
  ssr: false,
  loading: () => <div className="h-64 rounded-panel border border-line bg-surface" />,
});

export default function PrikbordPaneel({ ingelogd }: { ingelogd: boolean }) {
  return <Prikbord ingelogd={ingelogd} />;
}
