"use client";

import dynamic from "next/dynamic";

/**
 * Laadt Instellingen pas bij gebruik, net als chat/kennis/kosten — dit scherm trekt de
 * Supabase-browserclient (voor de directe avatar-upload naar Storage) mee, en wie
 * alleen de campagnetabel bekijkt hoort daar niets van te merken.
 */
const Instellingen = dynamic(() => import("@/components/instellingen/Instellingen"), {
  ssr: false,
  loading: () => <div className="h-64 rounded-panel border border-line bg-surface" />,
});

export default function InstellingenPaneel({
  ingelogd,
  email,
}: {
  ingelogd: boolean;
  email: string | null;
}) {
  return <Instellingen ingelogd={ingelogd} email={email} />;
}
