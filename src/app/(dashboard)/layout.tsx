import { requireAuth } from "../lib/auth-guard";
import Sidebar from "./sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <Sidebar
        user={{
          name: user.name,
          email: user.email,
          role: user.role,
        }}
      />

      <div className="min-w-0 flex-1">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8">
          <div>
            <p className="text-sm font-semibold">
              OQC Inventory Management
            </p>

            <p className="text-xs text-slate-500">
              Product Stock Monitoring System
            </p>
          </div>

          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
            {user.role}
          </span>
        </header>

        <main className="p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}