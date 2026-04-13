import { PortalAuthGate } from "@/components/portal/PortalAuthGate";
import TaiwanPortalPage from "@/components/portal/TaiwanPortalPage";

/**
 * Taiwan hybrid portal (V5.1): `viewMode`, search, list / swipe engines,
 * bulk ActionBar, and group side panel live in {@link TaiwanPortalPage}.
 */
export default function ZhTWPortalRoutePage() {
  return (
    <PortalAuthGate>
      <TaiwanPortalPage />
    </PortalAuthGate>
  );
}
