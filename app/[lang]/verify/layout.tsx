import { DashboardLayout } from "@/components/layout/DashboardLayout";
import type { ReactNode } from "react";

export default function LangVerifyLayout({ children }: { children: ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
