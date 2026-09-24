"use client";

import { useCallback, useEffect, useState } from "react";

type DashboardProduct = {
  id: string;
  type: "HT" | "HK";
  computerCode: string;
  partNo: string;
  productName: string;
  initialStock: number;
  incoming: number;
  outgoing: number;
  ng: number;
  spare: number;
  finalStock: number;
  isActive: boolean;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("id-ID").format(value);

export default function DashboardPage() {
  const [products, setProducts] = useState<DashboardProduct[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const [search, setSearch] = useState("");
  const [type, setType] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDashboard = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams({
          search,
          type,
          page: String(page),
          limit: "10",
        });

        const response = await fetch(
          `/api/dashboard?${params.toString()}`,
          {
            cache: "no-store",
          }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || "Gagal mengambil data Dashboard"
          );
        }

        setProducts(result.data);
        setPagination(result.pagination);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan"
        );
      } finally {
        setLoading(false);
      }
    },
    [search, type]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDashboard(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [fetchDashboard]);

  // SUMMARY TOTAL
  const totalProducts = pagination.total;

  const totalInitialStock = products.reduce(
    (sum, item) => sum + item.initialStock,
    0
  );

  const totalIncoming = products.reduce(
    (sum, item) => sum + item.incoming,
    0
  );

  const totalOutgoing = products.reduce(
    (sum, item) => sum + item.outgoing,
    0
  );

  const totalNG = products.reduce(
    (sum, item) => sum + item.ng,
    0
  );

  const totalSpare = products.reduce(
    (sum, item) => sum + item.spare,
    0
  );

  const totalFinalStock = products.reduce(
    (sum, item) => sum + item.finalStock,
    0
  );

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Dashboard OQC
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Monitoring stok produk HT & HK
          </p>
        </div>

        <button
          onClick={() => fetchDashboard(pagination.page)}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Memuat..." : "↻ Refresh Data"}
        </button>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        <SummaryCard
          title="Total Produk"
          value={formatNumber(totalProducts)}
          description="Sesuai filter"
          icon="📦"
        />

        <SummaryCard
          title="Initial Stock"
          value={formatNumber(totalInitialStock)}
          description="Stok awal halaman ini"
          icon="🏭"
        />

        <SummaryCard
          title="Total Incoming"
          value={formatNumber(totalIncoming)}
          description="Barang masuk halaman ini"
          icon="📥"
        />

        <SummaryCard
          title="Total Outgoing"
          value={formatNumber(totalOutgoing)}
          description="Barang keluar halaman ini"
          icon="📤"
        />

        <SummaryCard
          title="Total NG"
          value={formatNumber(totalNG)}
          description="Total NG halaman ini"
          icon="⚠️"
        />

        <SummaryCard
          title="Total Spare"
          value={formatNumber(totalSpare)}
          description="Total Spare halaman ini"
          icon="🔧"
        />

        <SummaryCard
          title="Final Stock"
          value={formatNumber(totalFinalStock)}
          description="Stok akhir halaman ini"
          icon="📊"
        />
      </div>

      {/* TABLE CONTAINER */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* FILTER */}
        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">
              Product Stock Overview
            </h2>

            <p className="text-sm text-gray-500">
              Rekap stok berdasarkan transaksi
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              placeholder="Cari Computer Code / Part No..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 sm:w-64"
            />

            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option value="ALL">Semua Produksi</option>
              <option value="HT">HT</option>
              <option value="HK">HK</option>
            </select>
          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-4 py-3">No</th>
                <th className="px-4 py-3">Computer Code</th>
                <th className="px-4 py-3">Part No</th>
                <th className="px-4 py-3">Product Name</th>
                <th className="px-4 py-3">Production</th>
                <th className="px-4 py-3 text-right">Initial Stock</th>
                <th className="px-4 py-3 text-right">Incoming</th>
                <th className="px-4 py-3 text-right">Outgoing</th>
                <th className="px-4 py-3 text-right">NG</th>
                <th className="px-4 py-3 text-right">Spare</th>
                <th className="px-4 py-3 text-right">Final Stock</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    Memuat data Dashboard...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    Tidak ada data produk ditemukan.
                  </td>
                </tr>
              ) : (
                products.map((product, index) => (
                  <tr
                    key={product.id}
                    className="transition hover:bg-blue-50/40"
                  >
                    <td className="px-4 py-3 text-gray-500">
                      {(pagination.page - 1) * pagination.limit +
                        index +
                        1}
                    </td>

                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {product.computerCode}
                    </td>

                    <td className="px-4 py-3 text-gray-700">
                      {product.partNo}
                    </td>

                    <td className="px-4 py-3 text-gray-700">
                      {product.productName}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`rounded-md px-2.5 py-1 text-xs font-bold ${
                          product.type === "HT"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {product.type}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right">
                      {formatNumber(product.initialStock)}
                    </td>

                    <td className="px-4 py-3 text-right font-medium text-green-600">
                      {formatNumber(product.incoming)}
                    </td>

                    <td className="px-4 py-3 text-right font-medium text-blue-600">
                      {formatNumber(product.outgoing)}
                    </td>

                    <td className="px-4 py-3 text-right font-medium text-red-600">
                      {formatNumber(product.ng)}
                    </td>

                    <td className="px-4 py-3 text-right font-medium text-orange-600">
                      {formatNumber(product.spare)}
                    </td>

                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                      {formatNumber(product.finalStock)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500">
            Total {formatNumber(pagination.total)} produk
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                fetchDashboard(pagination.page - 1)
              }
              disabled={loading || pagination.page <= 1}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Previous
            </button>

            <span className="px-2 text-sm text-gray-600">
              {pagination.page} / {pagination.totalPages || 1}
            </span>

            <button
              onClick={() =>
                fetchDashboard(pagination.page + 1)
              }
              disabled={
                loading ||
                pagination.page >= pagination.totalPages
              }
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">
          {title}
        </p>

        <span className="text-xl">{icon}</span>
      </div>

      <p className="mt-3 text-2xl font-bold text-gray-900">
        {value}
      </p>

      <p className="mt-1 text-xs text-gray-500">
        {description}
      </p>
    </div>
  );
}