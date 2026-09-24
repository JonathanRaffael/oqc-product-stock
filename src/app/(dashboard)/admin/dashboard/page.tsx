import { redirect } from "next/navigation";
import { requireAdmin } from "../../../lib/auth-guard";

export default async function AdminDashboardPage() {
  await requireAdmin();

  // Dashboard Admin menggunakan tampilan dashboard utama
  redirect("/dashboard");
}