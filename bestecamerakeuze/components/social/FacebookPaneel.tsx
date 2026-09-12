"use client";

import dynamic from "next/dynamic";

/**
 * Laadt de Facebook-pagina pas bij gebruik, net als de chat, de kennisbank en de
 * kosten: Recharts is de zwaarste afhankelijkheid van de app en hoort niet in de
 * bundel te zitten van iemand die alleen de campagnetabel opent.
 */
const Facebook = dynamic(() => import("@/components/social/Facebook"), {
  ssr: false,
  loading: () => <div className="h-64 rounded-panel border border-line bg-surface" />,
});

export default function FacebookPaneel({ ingelogd }: { ingelogd: boolean }) {
  return <Facebook ingelogd={ingelogd} />;
}
