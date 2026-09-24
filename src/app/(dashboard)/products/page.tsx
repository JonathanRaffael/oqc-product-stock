"use client";

import { useCallback, useEffect, useState } from "react";

type Product = {
  id: string;
  type: "HT" | "HK";
  computerCode: string;
  partNo: string;
  productName: string;
  initialStock: number;
  isActive: boolean;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ProductForm = {
  type: "HT" | "HK";
  computerCode: string;
  partNo: string;
  productName: string;
  initialStock: string;
};

const emptyForm: ProductForm = {
  type: "HT",
  computerCode: "",
  partNo: "",
  productName: "",
  initialStock: "0",
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [type, setType] = useState("ALL");
  const [status, setStatus] = useState("ACTIVE");

  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const [isAdmin, setIsAdmin] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState("");

  const [form, setForm] = useState<ProductForm>(emptyForm);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // ==========================================
  // CHECK LOGIN ROLE
  // ==========================================

  useEffect(() => {
    async function checkUser() {
      try {
        const response = await fetch("/api/auth/me");
        const result = await response.json();

        const user = result.user ?? result.data ?? result;

        setIsAdmin(response.ok && user?.role === "ADMIN");
      } catch (error) {
        console.error("CHECK USER ERROR:", error);
      }
    }

    checkUser();
  }, []);

  // ==========================================
  // FETCH PRODUCTS
  // ==========================================

  const fetchProducts = useCallback(
    async (page = 1) => {
      setLoading(true);

      try {
        const params = new URLSearchParams({
          search,
          type,
          status,
          page: String(page),
          limit: "10",
        });

        const response = await fetch(`/api/products?${params}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Gagal mengambil produk");
        }

        setProducts(result.data);
        setPagination(result.pagination);
      } catch (error) {
        console.error(error);
        setError("Gagal mengambil data Product Master");
      } finally {
        setLoading(false);
      }
    },
    [search, type, status]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [fetchProducts]);

  // ==========================================
  // FORM HANDLER
  // ==========================================

  function updateForm(field: keyof ProductForm, value: string) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function openAddForm() {
    setEditingProduct(null);
    setForm(emptyForm);
    setShowForm(true);
    setMessage("");
    setError("");
  }

  function openEditForm(product: Product) {
    setEditingProduct(product);

    setForm({
      type: product.type,
      computerCode: product.computerCode,
      partNo: product.partNo,
      productName: product.productName,
      initialStock: String(product.initialStock),
    });

    setShowForm(true);
    setMessage("");
    setError("");
  }

  function closeForm() {
    setShowForm(false);
    setEditingProduct(null);
    setForm(emptyForm);
  }

  // ==========================================
  // ADD / EDIT PRODUCT
  // ==========================================

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const isEditing = Boolean(editingProduct);

      const response = await fetch("/api/products", {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(isEditing ? { id: editingProduct?.id } : {}),
          type: form.type,
          computerCode: form.computerCode.trim(),
          partNo: form.partNo.trim(),
          productName: form.productName.trim(),
          initialStock: Number(form.initialStock),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
            (isEditing ? "Gagal mengedit produk" : "Gagal menambahkan produk")
        );
      }

      setMessage(
        isEditing
          ? "Produk berhasil diperbarui!"
          : "Produk berhasil ditambahkan!"
      );

      closeForm();
      await fetchProducts(1);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Terjadi kesalahan"
      );
    } finally {
      setSaving(false);
    }
  }

  // ==========================================
  // ACTIVATE / DEACTIVATE
  // ==========================================

  async function handleToggleStatus(product: Product) {
    const nextStatus = !product.isActive;

    const confirmed = window.confirm(
      nextStatus
        ? `Aktifkan produk ${product.computerCode}?`
        : `Nonaktifkan produk ${product.computerCode}?\n\nProduk nonaktif tidak dapat digunakan untuk transaksi baru.`
    );

    if (!confirmed) return;

    setActionId(product.id);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/products", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: product.id,
          isActive: nextStatus,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal mengubah status produk");
      }

      setMessage(result.message || "Status produk berhasil diubah.");

      await fetchProducts(pagination.page);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Terjadi kesalahan"
      );
    } finally {
      setActionId("");
    }
  }

  // ==========================================
  // DELETE PRODUCT
  // ==========================================

  async function handleDelete(product: Product) {
    const confirmed = window.confirm(
      `Yakin ingin menghapus produk ini?\n\n` +
        `Type: ${product.type}\n` +
        `Computer Code: ${product.computerCode}\n` +
        `Part No: ${product.partNo}\n\n` +
        `Produk yang memiliki riwayat transaksi tidak dapat dihapus.`
    );

    if (!confirmed) return;

    setActionId(product.id);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `/api/products?id=${encodeURIComponent(product.id)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal menghapus produk");
      }

      setMessage("Produk berhasil dihapus!");

      // Jika item terakhir pada halaman dihapus, mundur satu halaman
      const nextPage =
        products.length === 1 && pagination.page > 1
          ? pagination.page - 1
          : pagination.page;

      await fetchProducts(nextPage);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Terjadi kesalahan"
      );
    } finally {
      setActionId("");
    }
  }

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Product Master
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Master data produk OQC PT. Hang Tong Manufactory
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-lg bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
            Total Produk: {pagination.total}
          </div>

          {isAdmin && (
            <button
              onClick={showForm ? closeForm : openAddForm}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              {showForm ? "Tutup Form" : "+ Add Product"}
            </button>
          )}
        </div>
      </div>

      {/* ALERT */}
      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ADD / EDIT FORM */}
      {showForm && isAdmin && (
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {editingProduct ? "Edit Produk" : "Tambah Produk Baru"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {editingProduct
                ? "Perbarui informasi produk."
                : "Masukkan data produk ke Product Master."}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* TYPE */}
            <div>
              <label className="mb-1 block text-sm font-medium">
                Production Type *
              </label>

              <select
                required
                value={form.type}
                onChange={(e) => updateForm("type", e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
              >
                <option value="HT">HT</option>
                <option value="HK">HK</option>
              </select>
            </div>

            {/* COMPUTER CODE */}
            <div>
              <label className="mb-1 block text-sm font-medium">
                Computer Code *
              </label>

              <input
                required
                maxLength={100}
                value={form.computerCode}
                onChange={(e) => updateForm("computerCode", e.target.value)}
                placeholder="Masukkan Computer Code"
                className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
              />
            </div>

            {/* PART NO */}
            <div>
              <label className="mb-1 block text-sm font-medium">
                Part No *
              </label>

              <input
                required
                maxLength={100}
                value={form.partNo}
                onChange={(e) => updateForm("partNo", e.target.value)}
                placeholder="Masukkan Part No"
                className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
              />
            </div>

            {/* PRODUCT NAME */}
            <div>
              <label className="mb-1 block text-sm font-medium">
                Product Name *
              </label>

              <input
                required
                maxLength={200}
                value={form.productName}
                onChange={(e) => updateForm("productName", e.target.value)}
                placeholder="Masukkan Product Name"
                className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
              />
            </div>

            {/* INITIAL STOCK */}
            <div>
              <label className="mb-1 block text-sm font-medium">
                Initial Stock (PCS) *
              </label>

              <input
                required
                type="number"
                min="0"
                step="1"
                value={form.initialStock}
                onChange={(e) => updateForm("initialStock", e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
              />
            </div>
          </div>

          {editingProduct && (
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              Perubahan Initial Stock akan memengaruhi perhitungan Final Stock
              pada Dashboard.
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving
                ? "Menyimpan..."
                : editingProduct
                  ? "Simpan Perubahan"
                  : "Simpan Produk"}
            </button>

            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {/* FILTER */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <input
            type="text"
            placeholder="Cari Computer Code, Part No, Product Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />

          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="ALL">Semua Produksi</option>
            <option value="HT">HT</option>
            <option value="HK">HK</option>
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="ACTIVE">Produk Aktif</option>
            <option value="INACTIVE">Produk Nonaktif</option>
            <option value="ALL">Semua Status</option>
          </select>
        </div>
      </div>

      {/* PRODUCT TABLE */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-4">No</th>
                <th className="px-5 py-4">Type</th>
                <th className="px-5 py-4">Computer Code</th>
                <th className="px-5 py-4">Part No</th>
                <th className="px-5 py-4">Product Name</th>
                <th className="px-5 py-4 text-right">Initial Stock</th>
                <th className="px-5 py-4">Status</th>
                {isAdmin && <th className="px-5 py-4">Action</th>}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 8 : 7}
                    className="px-5 py-10 text-center text-slate-500"
                  >
                    Memuat data produk...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 8 : 7}
                    className="px-5 py-10 text-center text-slate-500"
                  >
                    Data produk tidak ditemukan.
                  </td>
                </tr>
              ) : (
                products.map((product, index) => (
                  <tr
                    key={product.id}
                    className="transition hover:bg-slate-50"
                  >
                    <td className="px-5 py-4 text-slate-500">
                      {(pagination.page - 1) * pagination.limit + index + 1}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-bold ${
                          product.type === "HT"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {product.type}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 font-semibold">
                      {product.computerCode}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      {product.partNo}
                    </td>

                    <td className="px-5 py-4">{product.productName}</td>

                    <td className="px-5 py-4 text-right font-semibold">
                      {product.initialStock.toLocaleString("id-ID")} PCS
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          product.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {product.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>

                    {isAdmin && (
                      <td className="px-5 py-4">
                        <div className="flex min-w-[260px] flex-wrap gap-2">
                          <button
                            onClick={() => openEditForm(product)}
                            disabled={Boolean(actionId)}
                            className="rounded-md bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => handleToggleStatus(product)}
                            disabled={Boolean(actionId)}
                            className={`rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                              product.isActive
                                ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                : "bg-green-50 text-green-700 hover:bg-green-100"
                            }`}
                          >
                            {actionId === product.id
                              ? "Memproses..."
                              : product.isActive
                                ? "Nonaktifkan"
                                : "Aktifkan"}
                          </button>

                          <button
                            onClick={() => handleDelete(product)}
                            disabled={Boolean(actionId)}
                            className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                          >
                            Hapus
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
        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Total {pagination.total} produk
          </p>

          <div className="flex items-center gap-2">
            <button
              disabled={pagination.page <= 1 || loading}
              onClick={() => fetchProducts(pagination.page - 1)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs disabled:opacity-40"
            >
              Sebelumnya
            </button>

            <span className="px-2 text-xs text-slate-600">
              {pagination.page} / {Math.max(1, pagination.totalPages)}
            </span>

            <button
              disabled={
                pagination.page >= pagination.totalPages || loading
              }
              onClick={() => fetchProducts(pagination.page + 1)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs disabled:opacity-40"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}