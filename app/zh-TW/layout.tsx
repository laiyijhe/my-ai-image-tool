import { LangFromSegment } from "@/components/LangFromSegment";

export default function ZhTWLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <LangFromSegment locale="zh-TW" />
      {children}
    </>
  );
}
