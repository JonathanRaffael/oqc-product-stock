"use client";

import { useCallback, useEffect, useState } from "react";

type UserData = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "USER";
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
};

type UserForm = {
  id?: string;
  name: string;
  email: string;
  password: string;
  role: "ADMIN" | "USER";
};

const emptyForm: UserForm = {
  name: "",
  email: "",
  password: "",
  role: "USER",
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("id-ID").format(value);

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const buttonOutlineClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<UserForm>(emptyForm);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [currentUserId, setCurrentUserId] = useState("");

  // Ambil ID user yang sedang login
  const loadCurrentUser = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", {
        cache: "no-store",
      });

      const result = await response.json();

      if (response.ok && result.success && result.user) {
        setCurrentUserId(result.user.id);
      }
    } catch {
      // ID hanya digunakan untuk proteksi tombol UI.
    }
  }, []);

  // Ambil data user
  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        search,
        role: roleFilter,
        status: statusFilter,
        page: String(page),
        limit: "10",
      });

      const response = await fetch(`/api/users?${params.toString()}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal mengambil data user");
      }

      setUsers(result.data || []);
      setTotal(result.pagination?.total || 0);
      setTotalPages(Math.max(1, result.pagination?.totalPages || 1));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Terjadi kesalahan"
      );
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter, page]);

  useEffect(() => {
    loadCurrentUser();
  }, [loadCurrentUser]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsers();
    }, 300);

    return () => clearTimeout(timer);
  }, [loadUsers]);

  // Modal tambah user
  function openAddModal() {
    setEditing(false);
    setForm(emptyForm);
    setError("");
    setShowModal(true);
  }

  // Modal edit user
  function openEditModal(user: UserData) {
    setEditing(true);

    setForm({
      id: user.id,
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
    });

    setError("");
    setShowModal(true);
  }

  // Simpan tambah / edit user
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const method = editing ? "PUT" : "POST";

      const body = editing
        ? {
            id: form.id,
            name: form.name,
            email: form.email,
            role: form.role,
          }
        : {
            name: form.name,
            email: form.email,
            password: form.password,
            role: form.role,
          };

      const response = await fetch("/api/users", {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal menyimpan user");
      }

      setShowModal(false);
      setForm(emptyForm);
      setMessage(result.message || "Data user berhasil disimpan");

      await loadUsers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal menyimpan user"
      );
    } finally {
      setSaving(false);
    }
  }

  // Aktif / nonaktif akun
  async function toggleStatus(user: UserData) {
    const nextStatus = !user.isActive;

    const confirmed = window.confirm(
      `Yakin ingin ${
        nextStatus ? "mengaktifkan" : "menonaktifkan"
      } akun ${user.name}?`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: user.id,
          isActive: nextStatus,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Gagal mengubah status akun"
        );
      }

      setMessage(result.message || "Status akun berhasil diperbarui");

      await loadUsers();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengubah status akun"
      );
    }
  }

  // Hapus user
  async function deleteUser(user: UserData) {
    const confirmed = window.confirm(
      `Hapus akun ${user.name} (${user.email})?\n\nAkun yang memiliki riwayat transaksi tidak dapat dihapus.`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/users?id=${encodeURIComponent(user.id)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal menghapus user");
      }

      setMessage(result.message || "User berhasil dihapus");

      const targetPage =
        users.length === 1 && page > 1 ? page - 1 : page;

      if (targetPage !== page) {
        setPage(targetPage);
      } else {
        await loadUsers();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal menghapus user"
      );
    }
  }

  // Reset filter
  function resetFilters() {
    setSearch("");
    setRoleFilter("ALL");
    setStatusFilter("ALL");
    setPage(1);
  }

  function changeFilter(
    setter: (value: string) => void,
    value: string
  ) {
    setter(value);
    setPage(1);
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            User Management
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Kelola akun dan hak akses pengguna sistem OQC.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <span className="text-base">+</span>
          Tambah User
        </button>
      </div>

      {/* ALERT SUCCESS */}
      {message && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700">
          <p>{message}</p>

          <button
            onClick={() => setMessage("")}
            className="font-semibold text-green-700 hover:text-green-900"
          >
            ×
          </button>
        </div>
      )}

      {/* ALERT ERROR */}
      {error && !showModal && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{error}</p>

          <button
            onClick={() => setError("")}
            className="font-semibold text-red-700 hover:text-red-900"
          >
            ×
          </button>
        </div>
      )}

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Total User */}
        <div className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">
              Total User
            </p>

            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-lg text-blue-600">
              ♙
            </span>
          </div>

          <p className="mt-3 text-2xl font-bold text-slate-900">
            {formatNumber(total)}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Berdasarkan filter saat ini
          </p>
        </div>

        {/* Admin */}
        <div className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">
              Admin
            </p>

            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-lg text-purple-600">
              ◈
            </span>
          </div>

          <p className="mt-3 text-2xl font-bold text-purple-600">
            {formatNumber(
              users.filter((u) => u.role === "ADMIN").length
            )}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Pada halaman ini
          </p>
        </div>

        {/* User Aktif */}
        <div className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">
              User Aktif
            </p>

            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 text-lg text-green-600">
              ✓
            </span>
          </div>

          <p className="mt-3 text-2xl font-bold text-green-600">
            {formatNumber(
              users.filter((u) => u.isActive).length
            )}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Pada halaman ini
          </p>
        </div>
      </div>

      {/* FILTER */}
      <div className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-800">
            Filter Pengguna
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Cari dan filter data berdasarkan nama, role, atau status.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={search}
            onChange={(e) =>
              changeFilter(setSearch, e.target.value)
            }
            placeholder="Cari nama atau email..."
            className={inputClass}
          />

          <select
            value={roleFilter}
            onChange={(e) =>
              changeFilter(setRoleFilter, e.target.value)
            }
            className={inputClass}
          >
            <option value="ALL">Semua Role</option>
            <option value="ADMIN">Admin</option>
            <option value="USER">User</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) =>
              changeFilter(setStatusFilter, e.target.value)
            }
            className={inputClass}
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Nonaktif</option>
          </select>

          <button
            onClick={resetFilters}
            className={buttonOutlineClass}
          >
            Reset Filter
          </button>
        </div>
      </div>

      {/* USER TABLE */}
      <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
        {/* TABLE HEADER */}
        <div className="flex flex-col gap-2 border-b border-slate-300 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">
              Daftar Pengguna
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Total {formatNumber(total)} user ditemukan
            </p>
          </div>

          <span className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
            Halaman {page} / {totalPages}
          </span>
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="border-b border-slate-300 bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3.5 font-semibold">
                  No
                </th>

                <th className="px-4 py-3.5 font-semibold">
                  Nama
                </th>

                <th className="px-4 py-3.5 font-semibold">
                  Email
                </th>

                <th className="px-4 py-3.5 font-semibold">
                  Role
                </th>

                <th className="px-4 py-3.5 font-semibold">
                  Status
                </th>

                <th className="px-4 py-3.5 font-semibold">
                  Tanggal Dibuat
                </th>

                <th className="px-4 py-3.5 text-center font-semibold">
                  Aksi
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
                      Memuat data user...
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    <div className="font-medium">
                      Tidak ada user ditemukan.
                    </div>

                    <p className="mt-1 text-xs text-slate-400">
                      Coba ubah kata kunci atau filter pencarian.
                    </p>
                  </td>
                </tr>
              ) : (
                users.map((user, index) => (
                  <tr
                    key={user.id}
                    className="transition-colors hover:bg-slate-50"
                  >
                    <td className="px-4 py-3.5 text-slate-500">
                      {(page - 1) * 10 + index + 1}
                    </td>

                    <td className="px-4 py-3.5 font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <span>{user.name}</span>

                        {user.id === currentUserId && (
                          <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                            Kamu
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-slate-600">
                      {user.email}
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          user.role === "ADMIN"
                            ? "border-purple-200 bg-purple-50 text-purple-700"
                            : "border-slate-200 bg-slate-100 text-slate-700"
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          user.isActive
                            ? "border-green-200 bg-green-50 text-green-700"
                            : "border-red-200 bg-red-50 text-red-700"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            user.isActive
                              ? "bg-green-500"
                              : "bg-red-500"
                          }`}
                        />

                        {user.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">
                      {new Date(user.createdAt).toLocaleDateString(
                        "id-ID",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        }
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(user)}
                          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => toggleStatus(user)}
                          disabled={user.id === currentUserId}
                          className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                            user.isActive
                              ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                              : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                          }`}
                        >
                          {user.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </button>

                        <button
                          onClick={() => deleteUser(user)}
                          disabled={user.id === currentUserId}
                          className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="flex flex-col gap-3 border-t border-slate-300 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Menampilkan {users.length > 0 ? (page - 1) * 10 + 1 : 0}
            {" - "}
            {(page - 1) * 10 + users.length} dari{" "}
            {formatNumber(total)} user
          </p>

          <div className="flex gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={buttonOutlineClass}
            >
              ← Sebelumnya
            </button>

            <button
              disabled={page >= totalPages || loading}
              onClick={() =>
                setPage((p) => Math.min(totalPages, p + 1))
              }
              className={buttonOutlineClass}
            >
              Berikutnya →
            </button>
          </div>
        </div>
      </div>

      {/* MODAL ADD / EDIT */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-[2px]">
          <div className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editing ? "Edit User" : "Tambah User"}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  {editing
                    ? "Perbarui informasi akun pengguna."
                    : "Buat akun pengguna baru untuk sistem OQC."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setError("");
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-xl text-slate-400 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            {/* MODAL BODY */}
            <div className="p-6">
              {error && (
                <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Nama */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Nama Lengkap
                  </label>

                  <input
                    required
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    className={inputClass}
                    placeholder="Masukkan nama user"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Email
                  </label>

                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    className={inputClass}
                    placeholder="user@company.com"
                  />
                </div>

                {/* Password awal */}
                {!editing && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Password Awal
                    </label>

                    <input
                      required
                      type="password"
                      minLength={8}
                      value={form.password}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          password: e.target.value,
                        })
                      }
                      className={inputClass}
                      placeholder="Minimal 8 karakter"
                    />

                    <p className="mt-1.5 text-xs text-slate-400">
                      Password minimal 8 karakter.
                    </p>
                  </div>
                )}

                {/* Role */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Role / Hak Akses
                  </label>

                  <select
                    value={form.role}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        role: e.target.value as "ADMIN" | "USER",
                      })
                    }
                    className={inputClass}
                  >
                    <option value="USER">User</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>

                {/* MODAL FOOTER */}
                <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setError("");
                    }}
                    disabled={saving}
                    className={buttonOutlineClass}
                  >
                    Batal
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving
                      ? "Menyimpan..."
                      : editing
                      ? "Simpan Perubahan"
                      : "Tambah User"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}