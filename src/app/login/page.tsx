"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.message || "Login gagal");
        return;
      }

      // Redirect sesuai role
      if (result.user.role === "ADMIN") {
        router.replace("/admin/dashboard");
      } else {
        router.replace("/dashboard");
      }

      router.refresh();
    } catch {
      setError("Tidak dapat terhubung ke server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0B1220] px-4 py-10 text-white">
      {/* Background Decoration */}
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-600/20 blur-[100px]" />
      <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-cyan-500/10 blur-[100px]" />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-[#111C2E] shadow-2xl md:grid-cols-2">
        {/* Left Panel */}
        <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#142D4E] to-[#0B1220] p-12 md:flex">
          <div className="absolute right-0 top-0 h-64 w-64 rounded-full border border-blue-400/10" />
          <div className="absolute -right-16 top-16 h-64 w-64 rounded-full border border-blue-400/10" />

          <div className="relative z-10">
            <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-500/15 text-xl font-bold text-blue-300 ring-1 ring-blue-400/30">
              HT
            </div>

            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-blue-300">
              PT. Hang Tong Manufactory
            </p>

            <h1 className="text-4xl font-bold leading-tight">
              OQC Product
              <br />
              Stock System
            </h1>

            <p className="mt-5 max-w-sm text-sm leading-7 text-slate-400">
              Integrated product stock monitoring system for
              incoming, outgoing, and quality control inventory.
            </p>
          </div>

          <div className="relative z-10 border-t border-white/10 pt-6">
            <p className="text-xs text-slate-500">
              INTERNAL SYSTEM · AUTHORIZED PERSONNEL ONLY
            </p>
          </div>
        </section>

        {/* Login Panel */}
        <section className="flex flex-col justify-center p-7 sm:p-12">
          <div className="mb-8 md:hidden">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/15 font-bold text-blue-300 ring-1 ring-blue-400/30">
              HT
            </div>

            <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
              PT. Hang Tong Manufactory
            </p>

            <h1 className="mt-2 text-2xl font-bold">
              OQC Product Stock
            </h1>
          </div>

          <div className="mb-8">
            <p className="mb-2 text-sm font-medium text-blue-400">
              WELCOME BACK
            </p>

            <h2 className="text-3xl font-bold tracking-tight">
              Sign In
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Masuk menggunakan akun OQC kamu.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Email Address
              </label>

              <input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="nama@htm.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="w-full rounded-lg border border-slate-700 bg-[#0B1220] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60"
              />
            </div>

            {/* Password */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-slate-300"
                >
                  Password
                </label>
              </div>

              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Masukkan password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full rounded-lg border border-slate-700 bg-[#0B1220] px-4 py-3 pr-20 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 hover:text-white"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="mt-8 border-t border-white/10 pt-5 text-center">
            <p className="text-xs text-slate-500">
              OQC Product Stock System
            </p>
            <p className="mt-1 text-xs text-slate-600">
              © {new Date().getFullYear()} PT. Hang Tong Manufactory
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}