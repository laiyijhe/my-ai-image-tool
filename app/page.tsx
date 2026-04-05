import { redirect } from "next/navigation";

/** Root `/` sends users to the default-locale marketing home. */
export default function RootPage() {
  redirect("/en");
}
