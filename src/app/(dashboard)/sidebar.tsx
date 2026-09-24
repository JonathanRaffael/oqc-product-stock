"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

type SidebarProps = {
  user: {
    name: string;
    email: string;
    role: string;
  };
};

const mainMenus = [
  { label: "Dashboard", href: "/dashboard", icon: "▦" },
  { label: "Incoming Stock", href: "/incoming", icon: "↓" },
  { label: "Outgoing Stock", href: "/outgoing", icon: "↑" },
  { label: "Product Master", href: "/products", icon: "▤" },
];

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const isAdmin = user.role === "ADMIN";

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  function menuClass(href: string) {
    const active =
      href === "/dashboard"
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`);

    return `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
      active
        ? "bg-blue-600/20 text-blue-300"
        : "text-slate-300 hover:bg-white/5 hover:text-white"
    }`;
  }

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setLogoutError("");

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Logout gagal. Silakan coba lagi.");
      }

      setShowLogoutModal(false);

      router.replace("/login");
      router.refresh();
    } catch (error) {
      setLogoutError(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat logout."
      );

      setLoggingOut(false);
    }
  }

  return (
    <>
      <aside className="flex min-h-screen w-64 shrink-0 flex-col bg-slate-950 text-white">
        {/* Header */}
        <div className="border-b border-white/10 px-6 py-6">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-blue-600 font-bold">
            HT
          </div>

          <h1 className="text-sm font-bold">OQC PRODUCT STOCK</h1>

          <p className="mt-1 text-xs text-slate-400">
            PT. Hang Tong Manufactory
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-5">
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Main Menu
          </p>

          {mainMenus.map((menu) => (
            <Link
              key={menu.href}
              href={menu.href}
              className={menuClass(menu.href)}
            >
              <span className="w-5 text-center">{menu.icon}</span>
              {menu.label}
            </Link>
          ))}

          {/* Admin Menu */}
{isAdmin && (
  <>
    <p className="mb-3 mt-7 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
      Administration
    </p>

    {/* User Management */}
    <Link
      href="/admin/users"
      className={menuClass("/admin/users")}
    >
      <span className="w-5 text-center">♙</span>
      User Management
    </Link>

    {/* Audit Log */}
    <Link
      href="/audit-logs"
      className={menuClass("/audit-logs")}
    >
      <span className="w-5 text-center">◷</span>
      Audit Log
    </Link>
  </>
)}
        </nav>

        {/* User Profile & Logout */}
        <div className="border-t border-white/10 p-4">
          <p className="truncate text-sm font-semibold">{user.name}</p>

          <p className="mt-1 truncate text-xs text-slate-400">
            {user.email}
          </p>

          <span className="mt-3 inline-block rounded-md bg-blue-500/10 px-2 py-1 text-[10px] font-bold text-blue-300">
            {user.role}
          </span>

          <button
            type="button"
            onClick={() => {
              setLogoutError("");
              setShowLogoutModal(true);
            }}
            className="mt-4 w-full rounded-lg border border-white/10 px-3 py-2.5 text-left text-xs font-medium text-slate-300 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
          >
            <span className="mr-2">↪</span>
            Logout
          </button>
        </div>
      </aside>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!loggingOut) setShowLogoutModal(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            className="w-full max-w-md animate-in fade-in zoom-in-95 rounded-2xl border border-gray-100 bg-white p-6 text-gray-900 shadow-2xl duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon */}
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-7 w-7 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </div>

            {/* Content */}
            <div className="text-center">
              <h2
                id="logout-title"
                className="text-xl font-bold text-gray-900"
              >
                Konfirmasi Logout
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                Apakah kamu yakin ingin keluar dari sistem OQC Product
                Stock?
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Kamu harus login kembali untuk mengakses sistem.
              </p>
            </div>

            {/* Error */}
            {logoutError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {logoutError}
              </div>
            )}

            {/* Buttons */}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                disabled={loggingOut}
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={loggingOut}
                onClick={handleLogout}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loggingOut ? "Logging out..." : "Ya, Logout"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}