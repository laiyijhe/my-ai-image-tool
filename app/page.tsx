import { redirect } from "next/navigation";

/** Root `/` — Taiwan-core default locale. */
export default function RootPage() {
  redirect("/zh-TW");
}
