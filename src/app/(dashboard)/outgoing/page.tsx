"use client";

import { useCallback, useEffect, useState } from "react";

type Product = {
  id: string;
  type: "HT" | "HK";
  computerCode: string;
  partNo: string;
  productName: string;
  initialStock: number;
};

type Outgoing = {
  id: string;
  date: string;
  quantityOut: number;
  ng: number;
  spare: number;
  remark: string | null;
  product: Product;
  responsible: {
    id: string;
    name: string;
  };
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const numberFormat = (value: number) =>
  new Intl.NumberFormat("id-ID").format(value);

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function getLocalDate(value?: string) {
  const date = value ? new Date(value) : new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getErrorMessage(
  result: { message?: string } | null,
  fallback: string
): string {
  return result?.message || fallback;
}

export default function OutgoingPage() {
  const [computerCode, setComputerCode] = useState("");
  const [product, setProduct] = useState<Product | null>(null);

  const [quantityOut, setQuantityOut] = useState("");
  const [ng, setNg] = useState("");
  const [spare, setSpare] = useState("");
  const [date, setDate] = useState(getLocalDate());
  const [remark, setRemark] = useState("");

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [page, setPage] = useState(1);

  const [history, setHistory] = useState<Outgoing[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [productLoading, setProductLoading] = useState(false);
  const [productError, setProductError] = useState("");

  // Role user
  const [isAdmin, setIsAdmin] = useState(false);

  // Edit modal
  const [editing, setEditing] = useState<Outgoing | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editQuantityOut, setEditQuantityOut] = useState("");
  const [editNG, setEditNG] = useState("");
  const [editSpare, setEditSpare] = useState("");
  const [editRemark, setEditRemark] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Ambil role user login
  useEffect(() => {
    const checkRole = async () => {
      try {
        const response = await fetch("/api/auth/me");
        const result = await response.json();

        const user = result.user ?? result.data ?? result;

        setIsAdmin(user?.role === "ADMIN");
      } catch {
        setIsAdmin(false);
      }
    };

    checkRole();
  }, []);

  const findProduct = useCallback(async () => {
  const code = computerCode.trim();

  setProduct(null);
  setProductError("");

  if (!code) return;

  try {
    setProductLoading(true);

    const params = new URLSearchParams({
      search: code,
      status: "ALL",
      page: "1",
      limit: "100",
    });

    const response = await fetch(`/api/products?${params}`);
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        getErrorMessage(result, "Gagal mencari produk")
      );
    }

    const foundProducts: Product[] = result.data.filter(
      (item: Product) =>
        item.computerCode.toLowerCase() === code.toLowerCase()
    );

    if (foundProducts.length === 0) {
      setProductError(
        "Computer Code tidak ditemukan di Product Master."
      );
      return;
    }

    if (foundProducts.length > 1) {
      setProductError(
        "Computer Code ditemukan di HT dan HK. Pastikan Computer Code yang digunakan unik."
      );
      return;
    }

    setProduct(foundProducts[0]);
  } catch (err) {
    setProductError(
      err instanceof Error
        ? err.message
        : "Gagal mencari produk."
    );
  } finally {
    setProductLoading(false);
  }
}, [computerCode]);

  const fetchHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      setError("");

      const params = new URLSearchParams({
        search,
        type: filterType,
        page: String(page),
        limit: "10",
      });

      const response = await fetch(`/api/outgoing?${params}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          getErrorMessage(result, "Gagal mengambil riwayat")
        );
      }

      setHistory(result.data);
      setPagination(result.pagination);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal mengambil riwayat"
      );
    } finally {
      setHistoryLoading(false);
    }
  }, [search, filterType, page]);

  useEffect(() => {
    const timer = setTimeout(findProduct, 400);
    return () => clearTimeout(timer);
  }, [findProduct]);

  useEffect(() => {
    const timer = setTimeout(fetchHistory, 300);
    return () => clearTimeout(timer);
  }, [fetchHistory]);

  const resetForm = () => {
    setComputerCode("");
    setProduct(null);
    setQuantityOut("");
    setNg("");
    setSpare("");
    setRemark("");
    setProductError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setMessage("");
    setError("");

    if (!product) {
      setError("Pilih Computer Code produk yang valid.");
      return;
    }

    const payload = {
  type: product.type,
  computerCode: product.computerCode,
  date,
  quantityOut: Number(quantityOut || 0),
  ng: Number(ng || 0),
  spare: Number(spare || 0),
  remark: remark.trim() || null,
};

    if (
      payload.quantityOut < 0 ||
      payload.ng < 0 ||
      payload.spare < 0 ||
      !Number.isInteger(payload.quantityOut) ||
      !Number.isInteger(payload.ng) ||
      !Number.isInteger(payload.spare) ||
      payload.quantityOut + payload.ng + payload.spare <= 0
    ) {
      setError(
        "Isi Qty Out, NG, atau Spare dengan angka valid lebih dari 0."
      );
      return;
    }

    try {
      setLoading(true);

      const response = await fetch("/api/outgoing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          getErrorMessage(result, "Gagal menyimpan Outgoing")
        );
      }

      setMessage("Transaksi Outgoing berhasil disimpan!");

      resetForm();
      setPage(1);

      // Refresh langsung menggunakan filter dan page pertama
      const params = new URLSearchParams({
        search,
        type: filterType,
        page: "1",
        limit: "10",
      });

      const historyResponse = await fetch(`/api/outgoing?${params}`);
      const historyResult = await historyResponse.json();

      if (historyResponse.ok && historyResult.success) {
        setHistory(historyResult.data);
        setPagination(historyResult.pagination);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal menyimpan transaksi Outgoing"
      );
    } finally {
      setLoading(false);
    }
  };

  // Buka modal edit
  const openEditModal = (item: Outgoing) => {
    setEditing(item);
    setEditDate(getLocalDate(item.date));
    setEditQuantityOut(String(item.quantityOut));
    setEditNG(String(item.ng));
    setEditSpare(String(item.spare));
    setEditRemark(item.remark || "");
    setMessage("");
    setError("");
  };

  const closeEditModal = () => {
    if (editLoading) return;

    setEditing(null);
  };

  // Simpan perubahan Outgoing
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editing || !isAdmin) return;

    setMessage("");
    setError("");

    const qOut = Number(editQuantityOut || 0);
    const qNG = Number(editNG || 0);
    const qSpare = Number(editSpare || 0);

    if (
      qOut < 0 ||
      qNG < 0 ||
      qSpare < 0 ||
      !Number.isInteger(qOut) ||
      !Number.isInteger(qNG) ||
      !Number.isInteger(qSpare) ||
      qOut + qNG + qSpare <= 0
    ) {
      setError("Qty Out, NG, dan Spare harus berupa angka valid.");
      return;
    }

    try {
      setEditLoading(true);

      const response = await fetch("/api/outgoing", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editing.id,
          date: editDate,
          quantityOut: qOut,
          ng: qNG,
          spare: qSpare,
          remark: editRemark.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          getErrorMessage(result, "Gagal mengubah transaksi")
        );
      }

      setEditing(null);
      setMessage("Transaksi Outgoing berhasil diperbarui!");

      await fetchHistory();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengubah transaksi Outgoing"
      );
    } finally {
      setEditLoading(false);
    }
  };

  // Hapus transaksi Outgoing
  const handleDelete = async (item: Outgoing) => {
    if (!isAdmin) return;

    const confirmed = window.confirm(
      `Yakin ingin menghapus transaksi Outgoing ${item.product.computerCode}?\n\nQty Out: ${numberFormat(item.quantityOut)} PCS\nNG: ${numberFormat(item.ng)} PCS\nSpare: ${numberFormat(item.spare)} PCS`
    );

    if (!confirmed) return;

    setMessage("");
    setError("");
    setDeletingId(item.id);

    try {
      const response = await fetch(
        `/api/outgoing?id=${encodeURIComponent(item.id)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          getErrorMessage(result, "Gagal menghapus transaksi")
        );
      }

      setMessage("Transaksi Outgoing berhasil dihapus!");

      // Jika halaman terakhir hanya memiliki satu data,
      // pindah ke halaman sebelumnya.
      if (history.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await fetchHistory();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal menghapus transaksi Outgoing"
      );
    } finally {
      setDeletingId(null);
    }
  };


  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Outgoing Stock
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Input dan monitoring pengeluaran stok OQC
        </p>
      </div>

      {/* FORM INPUT */}
<div className="rounded-xl border border-gray-200 bg-white shadow-sm">
  <div className="border-b border-gray-200 px-5 py-4">
    <h2 className="font-semibold text-gray-900">
      Form Outgoing Transaction
    </h2>
    <p className="mt-1 text-sm text-gray-500">
      Stok akan divalidasi otomatis sebelum transaksi disimpan.
    </p>
  </div>

  <form onSubmit={handleSubmit} className="space-y-5 p-5">
    {/* TRANSACTION DATE */}
    <div>
      <label className="mb-1.5 block text-sm font-medium">
        Transaction Date *
      </label>

      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        required
        className={inputClass}
      />
    </div>

          {/* COMPUTER CODE */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Computer Code *
            </label>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={computerCode}
                onChange={(e) => setComputerCode(e.target.value)}
                onBlur={findProduct}
                placeholder="Masukkan Computer Code"
                className={inputClass}
                required
              />

              <button
                type="button"
                onClick={findProduct}
                disabled={productLoading || !computerCode.trim()}
                className="rounded-lg border border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
              >
                {productLoading ? "Mencari..." : "Cari Produk"}
              </button>
            </div>

            {productError && (
              <p className="mt-2 text-sm text-red-600">
                {productError}
              </p>
            )}

            {product && (
              <div className="mt-3 grid grid-cols-1 gap-3 rounded-lg border border-green-200 bg-green-50 p-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-gray-500">Part No</p>
                  <p className="font-semibold text-gray-900">
                    {product.partNo}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Product Name</p>
                  <p className="font-semibold text-gray-900">
                    {product.productName}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Production</p>
                  <p className="font-semibold text-gray-900">
                    {product.type}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* QTY */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Qty Out (PCS)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={quantityOut}
                onChange={(e) => setQuantityOut(e.target.value)}
                className={inputClass}
                placeholder="0"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                NG (PCS)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={ng}
                onChange={(e) => setNg(e.target.value)}
                className={inputClass}
                placeholder="0"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Spare (PCS)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={spare}
                onChange={(e) => setSpare(e.target.value)}
                className={inputClass}
                placeholder="0"
              />
            </div>
          </div>

          {/* REMARK */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Remark
            </label>

            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={3}
              className={inputClass}
              placeholder="Catatan transaksi (opsional)"
            />
          </div>

          {/* MESSAGES */}
          {message && (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
              {message}
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* BUTTONS */}
          <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Reset
            </button>

            <button
              type="submit"
              disabled={loading || !product}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Menyimpan..." : "Simpan Outgoing"}
            </button>
          </div>
        </form>
      </div>


      {/* HISTORY */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">
              Outgoing History
            </h2>
            <p className="text-sm text-gray-500">
              Riwayat transaksi pengeluaran stok
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Cari Computer Code / Part No..."
              className={inputClass}
            />

            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setPage(1);
              }}
              className={inputClass}
            >
              <option value="ALL">Semua Produksi</option>
              <option value="HT">HT</option>
              <option value="HK">HK</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-4 py-3">No</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Computer Code</th>
                <th className="px-4 py-3">Part No</th>
                <th className="px-4 py-3">Product Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Qty Out</th>
                <th className="px-4 py-3 text-right">NG</th>
                <th className="px-4 py-3 text-right">Spare</th>
                <th className="px-4 py-3">Responsible</th>
                <th className="px-4 py-3">Remark</th>
                {isAdmin && (
                  <th className="px-4 py-3 text-center">Action</th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {historyLoading ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 12 : 11}
                    className="px-4 py-10 text-center text-gray-500"
                  >
                    Memuat riwayat...
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 12 : 11}
                    className="px-4 py-10 text-center text-gray-500"
                  >
                    Belum ada transaksi Outgoing.
                  </td>
                </tr>
              ) : (
                history.map((item, index) => (
                  <tr key={item.id} className="hover:bg-blue-50/40">
                    <td className="px-4 py-3">
                      {(page - 1) * 10 + index + 1}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(item.date).toLocaleDateString("id-ID")}
                    </td>

                    <td className="px-4 py-3 font-semibold">
                      {item.product.computerCode}
                    </td>

                    <td className="px-4 py-3">{item.product.partNo}</td>

                    <td className="px-4 py-3">
                      {item.product.productName}
                    </td>

                    <td className="px-4 py-3">{item.product.type}</td>

                    <td className="px-4 py-3 text-right">
                      {numberFormat(item.quantityOut)}
                    </td>

                    <td className="px-4 py-3 text-right text-red-600">
                      {numberFormat(item.ng)}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {numberFormat(item.spare)}
                    </td>

                    <td className="px-4 py-3">
                      {item.responsible.name}
                    </td>

                    <td className="px-4 py-3">
                      {item.remark || "-"}
                    </td>

                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            disabled={!!deletingId}
                            className="rounded-md bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-200 disabled:opacity-50"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            disabled={deletingId === item.id}
                            className="rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
                          >
                            {deletingId === item.id
                              ? "Menghapus..."
                              : "Delete"}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500">
            Total {numberFormat(pagination.total)} transaksi
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || historyLoading}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-40"
            >
              ← Previous
            </button>

            <span className="text-sm text-gray-600">
              {pagination.page} / {pagination.totalPages || 1}
            </span>

            <button
              onClick={() =>
                setPage((p) => Math.min(pagination.totalPages, p + 1))
              }
              disabled={
                page >= pagination.totalPages || historyLoading
              }
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* EDIT MODAL */}
      {editing && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-auto w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Edit Outgoing Transaction
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {editing.product.computerCode} — {editing.product.type}
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditModal}
                disabled={editLoading}
                className="rounded-lg px-3 py-1 text-xl text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-5 p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Transaction Date *
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Computer Code
                  </label>
                  <input
                    value={editing.product.computerCode}
                    readOnly
                    className={`${inputClass} bg-gray-100`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Qty Out (PCS)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editQuantityOut}
                    onChange={(e) => setEditQuantityOut(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    NG (PCS)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editNG}
                    onChange={(e) => setEditNG(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Spare (PCS)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editSpare}
                    onChange={(e) => setEditSpare(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Remark
                </label>
                <textarea
                  value={editRemark}
                  onChange={(e) => setEditRemark(e.target.value)}
                  rows={3}
                  className={inputClass}
                  placeholder="Catatan transaksi (opsional)"
                />
              </div>

              <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={editLoading}
                  className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={editLoading}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {editLoading ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
