import type { Metadata } from "next";
import type { ReactNode } from "react";

type Props = { children: ReactNode };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ creatorId: string }>;
}): Promise<Metadata> {
  const { creatorId } = await params;
  const label = decodeURIComponent(creatorId);
  return {
    title: `Member portal · ${label}`,
    description: "Enter your Member ID to view protected content.",
  };
}

export default function ViewLayout({ children }: Props) {
  return children;
}
