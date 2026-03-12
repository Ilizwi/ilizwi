import { redirect } from "next/navigation";

export default function RootPage() {
  // Root redirects to the app dashboard or login
  redirect("/login");
}
