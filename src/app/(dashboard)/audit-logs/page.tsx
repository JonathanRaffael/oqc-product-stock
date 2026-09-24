"use client";

import { useCallback, useEffect, useState } from "react";

type AuditLog = {
  id: string;
  action: string;
  productId: string | null;
  actorId: string | null;
  entityType: string;
  entityId: string | null;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  description: string | null;
  createdAt: string;

  actor: {
    id: string;
    name: string;
    email: string;
  } | null;

  product: {
    id: string;
    type: string;
    computerCode: string;
    partNo: string;
    productName: string;
  } | null;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "ACTIVATE",
  "DEACTIVATE",
  "INITIAL_STOCK_CHANGE",
];

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Create",
  UPDATE: "Update",
  DELETE: "Delete",
  ACTIVATE: "Activate",
  DEACTIVATE: "Deactivate",
  INITIAL_STOCK_CHANGE: "Initial Stock Change",
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
  ACTIVATE: "bg-emerald-100 text-emerald-700",
  DEACTIVATE: "bg-orange-100 text-orange-700",
  INITIAL_STOCK_CHANGE: "bg-purple-100 text-purple-700",
};

function formatDate(date: string) {
  return new Date(date).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatJsonValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }

  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

function getProductLabel(log: AuditLog) {
  const data = log.newData ?? log.oldData;

  const computerCode =
    log.product?.computerCode ??
    data?.computerCode;

  const type =
    log.product?.type ??
    data?.type;

  if (computerCode) {
    return `${type ?? "-"} / ${computerCode}`;
  }

  return log.entityId ?? "-";
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] =
    useState<Pagination>({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });

  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedLog, setSelectedLog] =
    useState<AuditLog | null>(null);

  const fetchLogs = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams();

        params.set("page", String(page));
        params.set("limit", "20");

        if (search.trim()) {
          params.set("search", search.trim());
        }

        if (action) {
          params.set("action", action);
        }

        if (entityType) {
          params.set("entityType", entityType);
        }

        const response = await fetch(
          `/api/audit-logs?${params.toString()}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.message ||
              "Gagal mengambil Audit Log"
          );
        }

        setLogs(result.data ?? []);
        setPagination(result.pagination);
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan"
        );
      } finally {
        setLoading(false);
      }
    },
    [search, action, entityType]
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchLogs(1);
    }, 300);

    return () => clearTimeout(timeout);
  }, [fetchLogs]);

  function resetFilters() {
    setSearch("");
    setAction("");
    setEntityType("");
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Audit Log
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Riwayat aktivitas dan perubahan data
            dalam sistem OQC Product Stock.
          </p>
        </div>

        <button
          onClick={() =>
            fetchLogs(pagination.page)
          }
          disabled={loading}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? "Loading..." : "↻ Refresh"}
        </button>
      </div>

      {/* SUMMARY */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">
            Total Audit Logs
          </p>

          <p className="mt-2 text-2xl font-bold text-gray-900">
            {pagination.total.toLocaleString("id-ID")}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">
            Logs di Halaman Ini
          </p>

          <p className="mt-2 text-2xl font-bold text-blue-600">
            {logs.length}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">
            Halaman
          </p>

          <p className="mt-2 text-2xl font-bold text-purple-600">
            {pagination.totalPages > 0
              ? `${pagination.page} / ${pagination.totalPages}`
              : "0"}
          </p>
        </div>
      </div>

      {/* FILTERS */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="font-semibold text-gray-900">
            Filter Audit Log
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Cari aktivitas berdasarkan deskripsi,
            produk, atau pengguna.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {/* SEARCH */}
          <input
            type="text"
            placeholder="Cari aktivitas..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          {/* ACTION */}
          <select
            value={action}
            onChange={(e) =>
              setAction(e.target.value)
            }
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            <option value="">Semua Action</option>

            {ACTIONS.map((item) => (
              <option key={item} value={item}>
                {ACTION_LABELS[item]}
              </option>
            ))}
          </select>

          {/* ENTITY TYPE */}
          <select
            value={entityType}
            onChange={(e) =>
              setEntityType(e.target.value)
            }
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            <option value="">Semua Entity</option>
            <option value="Product">Product</option>
            <option value="Incoming">Incoming</option>
            <option value="Outgoing">Outgoing</option>
            <option value="User">User</option>
          </select>

          {/* RESET */}
          <button
            onClick={resetFilters}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Reset Filter
          </button>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">
            Gagal memuat Audit Log
          </p>

          <p className="mt-1">{error}</p>
        </div>
      )}

      {/* TABLE */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="font-semibold text-gray-900">
              Activity History
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Menampilkan {logs.length} dari{" "}
              {pagination.total.toLocaleString("id-ID")}{" "}
              aktivitas
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1000px] w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-5 py-3">Waktu</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Produk</th>
                <th className="px-5 py-3">Actor</th>
                <th className="px-5 py-3">Deskripsi</th>
                <th className="px-5 py-3 text-center">
                  Detail
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-gray-500"
                  >
                    Memuat Audit Log...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-gray-500"
                  >
                    Tidak ada Audit Log ditemukan.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className="transition hover:bg-gray-50"
                  >
                    <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                      {formatDate(log.createdAt)}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
                          ACTION_COLORS[log.action] ??
                          "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {ACTION_LABELS[log.action] ??
                          log.action}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900">
                        {getProductLabel(log)}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        {log.product?.partNo ??
                          String(
                            log.newData?.partNo ??
                              log.oldData?.partNo ??
                              "-"
                          )}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900">
                        {log.actor?.name ??
                          "User tidak tersedia"}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        {log.actor?.email ?? "-"}
                      </p>
                    </td>

                    <td className="max-w-xs px-5 py-4">
                      <p className="line-clamp-2 text-gray-600">
                        {log.description ?? "-"}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={() =>
                          setSelectedLog(log)
                        }
                        className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="flex flex-col gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500">
            Halaman {pagination.page} dari{" "}
            {pagination.totalPages}
          </p>

          <div className="flex gap-2">
            <button
              disabled={
                loading || pagination.page <= 1
              }
              onClick={() =>
                fetchLogs(pagination.page - 1)
              }
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Previous
            </button>

            <button
              disabled={
                loading ||
                pagination.page >=
                  pagination.totalPages
              }
              onClick={() =>
                fetchLogs(pagination.page + 1)
              }
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* DETAIL MODAL */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* MODAL HEADER */}
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Audit Log Detail
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  ID: {selectedLog.id}
                </p>
              </div>

              <button
                onClick={() =>
                  setSelectedLog(null)
                }
                className="rounded-lg px-3 py-1.5 text-xl text-gray-500 hover:bg-gray-100"
              >
                ×
              </button>
            </div>

            <div className="space-y-6 p-6">
              {/* BASIC INFO */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500">
                    Action
                  </p>

                  <span
                    className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                      ACTION_COLORS[
                        selectedLog.action
                      ] ?? "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {ACTION_LABELS[
                      selectedLog.action
                    ] ?? selectedLog.action}
                  </span>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500">
                    Waktu
                  </p>

                  <p className="mt-2 text-sm text-gray-900">
                    {formatDate(
                      selectedLog.createdAt
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500">
                    Actor
                  </p>

                  <p className="mt-2 text-sm font-medium text-gray-900">
                    {selectedLog.actor?.name ??
                      "User tidak tersedia"}
                  </p>

                  <p className="text-xs text-gray-500">
                    {selectedLog.actor?.email ?? "-"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500">
                    Entity
                  </p>

                  <p className="mt-2 text-sm text-gray-900">
                    {selectedLog.entityType}
                  </p>

                  <p className="break-all text-xs text-gray-500">
                    {selectedLog.entityId ?? "-"}
                  </p>
                </div>
              </div>

              {/* DESCRIPTION */}
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase text-gray-500">
                  Deskripsi
                </p>

                <p className="mt-2 text-sm text-gray-800">
                  {selectedLog.description ?? "-"}
                </p>
              </div>

              {/* OLD & NEW DATA */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="overflow-hidden rounded-lg border border-red-200">
                  <div className="border-b border-red-200 bg-red-50 px-4 py-3">
                    <h3 className="text-sm font-semibold text-red-700">
                      Old Data
                    </h3>

                    <p className="mt-1 text-xs text-red-600">
                      Data sebelum perubahan
                    </p>
                  </div>

                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words p-4 text-xs text-gray-700">
                    {formatJsonValue(
                      selectedLog.oldData
                    )}
                  </pre>
                </div>

                <div className="overflow-hidden rounded-lg border border-green-200">
                  <div className="border-b border-green-200 bg-green-50 px-4 py-3">
                    <h3 className="text-sm font-semibold text-green-700">
                      New Data
                    </h3>

                    <p className="mt-1 text-xs text-green-600">
                      Data setelah perubahan
                    </p>
                  </div>

                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words p-4 text-xs text-gray-700">
                    {formatJsonValue(
                      selectedLog.newData
                    )}
                  </pre>
                </div>
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div className="flex justify-end border-t border-gray-200 px-6 py-4">
              <button
                onClick={() =>
                  setSelectedLog(null)
                }
                className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-gray-700"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}