import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Verify leak · Creator Guard",
  description:
    "Upload a protected image to extract the embedded Member ID from invisible watermarking.",
};

export default function VerifyLayout({ children }: { children: ReactNode }) {
  return children;
}
