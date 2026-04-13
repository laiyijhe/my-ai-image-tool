import PortalDashboard from "@/components/home/PortalDashboard";
import { PortalAuthGate } from "@/components/portal/PortalAuthGate";

export default function PortalPage() {
  return (
    <PortalAuthGate>
      <PortalDashboard />
    </PortalAuthGate>
  );
}
