  "use client";

  import { useCallback, useEffect, useState } from "react";

  type Product = {
    id: string;
    type: "HT" | "HK";
    computerCode: string;
    partNo: string;
    productName: string;
  };

  type Incoming = {
    id: string;
    date: string;
    quantity: number;
    remark: string | null;
    product: Product;
    responsible: {
      name: string;
    };
  };

  
  const formatNumber = (value: number) =>
    new Intl.NumberFormat("id-ID").format(value);

  const dateInputValue = (value: string) => {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  // Reusable styling
  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  const labelClass =
    "mb-1.5 block text-sm font-medium text-slate-700";

  const cardClass =
    "rounded-xl border border-slate-300 bg-white shadow-sm";

  export default function IncomingPage() {
    const [computerCode, setComputerCode] = useState("");
    const [date, setDate] = useState(dateInputValue(new Date().toISOString()));
    const [quantity, setQuantity] = useState("");
    const [remark, setRemark] = useState("");

    const [product, setProduct] = useState<Product | null>(null);
    const [productMessage, setProductMessage] = useState("");

    const [transactions, setTransactions] = useState<Incoming[]>([]);
    const [search, setSearch] = useState("");
    const [filterType, setFilterType] = useState("ALL");

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const [isAdmin, setIsAdmin] = useState(false);

    const [editing, setEditing] = useState<Incoming | null>(null);
    const [editDate, setEditDate] = useState("");
    const [editQuantity, setEditQuantity] = useState("");
    const [editRemark, setEditRemark] = useState("");
    const [editSaving, setEditSaving] = useState(false);

    const loadHistory = useCallback(
      async (targetPage = 1) => {
        setLoading(true);

        try {
          const params = new URLSearchParams({
            search,
            type: filterType,
            page: String(targetPage),
            limit: "10",
          });

          const response = await fetch(`/api/incoming?${params}`);
          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new Error(result.message || "Gagal memuat riwayat");
          }

          setTransactions(result.data);
          setPage(result.pagination.page);
          setTotalPages(Math.max(1, result.pagination.totalPages));
          setTotal(result.pagination.total);
        } catch (error) {
          console.error(error);
          alert("Gagal memuat riwayat Incoming");
        } finally {
          setLoading(false);
        }
      },
      [search, filterType]
    );

    useEffect(() => {
      const timer = setTimeout(() => loadHistory(1), 300);
      return () => clearTimeout(timer);
    }, [loadHistory]);

    // Cek role user
    useEffect(() => {
      async function checkRole() {
        try {
          const response = await fetch("/api/auth/me", {
            cache: "no-store",
          });

          const result = await response.json();
          const user = result.user ?? result.data ?? result;

          setIsAdmin(
            response.ok &&
              (user?.role === "ADMIN" || user?.role === "Admin")
          );
        } catch {
          setIsAdmin(false);
        }
      }

      checkRole();
    }, []);

    // Cari produk otomatis berdasarkan Computer Code
useEffect(() => {
  const code = computerCode.trim();

  setProduct(null);
  setProductMessage("");

  if (!code) return;

  const timer = setTimeout(async () => {
    try {
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
          result.message || "Gagal mencari produk"
        );
      }

      const foundProducts: Product[] = result.data.filter(
        (item: Product) =>
          item.computerCode.toLowerCase() === code.toLowerCase()
      );

      if (foundProducts.length === 0) {
        setProductMessage(
          "Computer Code tidak ditemukan di Product Master"
        );
        return;
      }

      if (foundProducts.length > 1) {
        setProductMessage(
          "Computer Code ditemukan di HT dan HK. Pastikan kode produk yang digunakan unik."
        );
        return;
      }

      setProduct(foundProducts[0]);
      setProductMessage("");
    } catch (error) {
      setProductMessage(
        error instanceof Error
          ? error.message
          : "Gagal mencari produk"
      );
    }
  }, 350);

  return () => clearTimeout(timer);
}, [computerCode]);

    // Tambah Incoming
    async function handleSubmit(e: React.FormEvent) {
      e.preventDefault();

      if (!product) {
        alert("Pilih Computer Code yang terdaftar di Product Master");
        return;
      }

      setSaving(true);

      try {
        const response = await fetch("/api/incoming", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
  type: product.type,
  computerCode: product.computerCode,
  date,
  quantity: Number(quantity),
  remark,
}),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Gagal menyimpan Incoming");
        }

        alert("Incoming berhasil disimpan");

        setComputerCode("");
        setQuantity("");
        setRemark("");
        setProduct(null);
        setProductMessage("");
        setDate(dateInputValue(new Date().toISOString()));

        await loadHistory(1);
      } catch (error) {
        alert(error instanceof Error ? error.message : "Terjadi kesalahan");
      } finally {
        setSaving(false);
      }
    }
    

    // Buka modal edit
    function openEdit(item: Incoming) {
      setEditing(item);
      setEditDate(dateInputValue(item.date));
      setEditQuantity(String(item.quantity));
      setEditRemark(item.remark || "");
    }

    // Simpan edit Incoming
    async function handleEditSubmit(e: React.FormEvent) {
      e.preventDefault();

      if (!editing) return;

      const qty = Number(editQuantity);

      if (!Number.isSafeInteger(qty) || qty <= 0) {
        alert("Incoming Qty harus bilangan bulat lebih dari 0");
        return;
      }

      setEditSaving(true);

      try {
        const response = await fetch("/api/incoming", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editing.id,
            date: editDate,
            quantity: qty,
            remark: editRemark,
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Gagal mengedit Incoming");
        }

        alert("Incoming berhasil diperbarui");
        setEditing(null);

        await loadHistory(page);
      } catch (error) {
        alert(error instanceof Error ? error.message : "Terjadi kesalahan");
      } finally {
        setEditSaving(false);
      }
    }

    // Hapus Incoming
    async function handleDelete(item: Incoming) {
      const confirmed = window.confirm(
        `Yakin ingin menghapus Incoming ${item.product.computerCode} sebanyak ${formatNumber(
          item.quantity
        )} PCS?`
      );

      if (!confirmed) return;

      try {
        const response = await fetch(
          `/api/incoming?id=${encodeURIComponent(item.id)}`,
          { method: "DELETE" }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Gagal menghapus Incoming");
        }

        alert("Incoming berhasil dihapus");

        const targetPage =
          transactions.length === 1 && page > 1 ? page - 1 : page;

        await loadHistory(targetPage);
      } catch (error) {
        alert(error instanceof Error ? error.message : "Terjadi kesalahan");
      }
    }

    return (
      <div className="space-y-6 pb-6">
        {/* HEADER */}
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <span>Inventory</span>
            <span>/</span>
            <span className="text-blue-600">Incoming Stock</span>
          </div>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-800">
            Incoming Stock
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Input dan riwayat barang masuk OQC
          </p>
        </div>

        {/* FORM INCOMING */}
        <form
          onSubmit={handleSubmit}
          className={`${cardClass} space-y-5 p-5 md:p-6`}
        >
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-lg text-blue-600">
              ↓
            </div>

            <div>
              <h2 className="font-semibold text-slate-800">
                Form Incoming
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Masukkan data barang masuk ke dalam sistem
              </p>
            </div>
          </div>

          <div className="grid gap-x-5 gap-y-4 md:grid-cols-3">
            <div>
              <label className={labelClass}>Tanggal</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
              />
            </div>

            

            <div>
              <label className={labelClass}>Computer Code</label>
              <input
                required
                value={computerCode}
                onChange={(e) => setComputerCode(e.target.value)}
                placeholder="Masukkan Computer Code"
                className={inputClass}
              />

              {productMessage && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-500">
                  <span>ⓘ</span>
                  {productMessage}
                </p>
              )}

              {product && (
  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-600">
    <span>✓</span>
    Produk ditemukan
  </p>
)}
            </div>
{/* TIPE PRODUKSI */}
<div>
  <label className={labelClass}>Tipe Produksi</label>

  <div
    className={`flex h-[42px] items-center rounded-lg border px-3 ${
      product
        ? product.type === "HT"
          ? "border-blue-200 bg-blue-50"
          : "border-purple-200 bg-purple-50"
        : "border-slate-200 bg-slate-50"
    }`}
  >
    {product ? (
      <span
        className={`flex items-center gap-2 text-sm font-semibold ${
          product.type === "HT"
            ? "text-blue-700"
            : "text-purple-700"
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            product.type === "HT"
              ? "bg-blue-500"
              : "bg-purple-500"
          }`}
        />
        {product.type}
      </span>
    ) : (
      <span className="text-sm text-slate-400">
        Otomatis dari Computer Code
      </span>
    )}
  </div>
</div>
            <div>
              <label className={labelClass}>Incoming Qty (PCS)</label>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Part No</label>
              <input
                readOnly
                value={product?.partNo || ""}
                placeholder="Otomatis dari Product Master"
                className={`${inputClass} cursor-not-allowed bg-slate-50 text-slate-500`}
              />
            </div>

            <div>
              <label className={labelClass}>Product Name</label>
              <input
                readOnly
                value={product?.productName || ""}
                placeholder="Otomatis dari Product Master"
                className={`${inputClass} cursor-not-allowed bg-slate-50 text-slate-500`}
              />
            </div>

            <div className="md:col-span-3">
              <label className={labelClass}>Remark</label>
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                rows={3}
                placeholder="Tambahkan catatan jika diperlukan..."
                className={`${inputClass} min-h-[90px] resize-y`}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-400">
              Pastikan data yang dimasukkan sudah benar.
            </p>

            <button
              type="submit"
              disabled={saving || !product}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <span>＋</span>
                  Simpan Incoming
                </>
              )}
            </button>
          </div>
        </form>

        {/* RIWAYAT INCOMING */}
        <div className={`${cardClass} overflow-hidden`}>
          {/* Table Header */}
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-lg text-slate-600">
                ☷
              </div>

              <div>
                <h2 className="font-semibold text-slate-800">
                  Riwayat Incoming
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Total{" "}
                  <span className="font-semibold text-slate-700">
                    {formatNumber(total)}
                  </span>{" "}
                  transaksi
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  ⌕
                </span>

                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Cari transaksi..."
                  className={`${inputClass} pl-9 sm:w-56`}
                />
              </div>

              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value);
                  setPage(1);
                }}
                className={`${inputClass} sm:w-36`}
              >
                <option value="ALL">Semua Type</option>
                <option value="HT">HT</option>
                <option value="HK">HK</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b border-slate-300 bg-slate-100">
                <tr className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3.5">Tanggal</th>
                  <th className="px-4 py-3.5">Type</th>
                  <th className="px-4 py-3.5">Computer Code</th>
                  <th className="px-4 py-3.5">Part No</th>
                  <th className="px-4 py-3.5">Product Name</th>
                  <th className="px-4 py-3.5 text-right">Qty (PCS)</th>
                  <th className="px-4 py-3.5">Responsible</th>
                  <th className="px-4 py-3.5">Remark</th>

                  {isAdmin && (
                    <th className="px-4 py-3.5 text-center">Aksi</th>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td
                      colSpan={isAdmin ? 9 : 8}
                      className="px-4 py-14 text-center"
                    >
                      <div className="flex items-center justify-center gap-3 text-sm text-slate-500">
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
                        Memuat data Incoming...
                      </div>
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isAdmin ? 9 : 8}
                      className="px-4 py-14 text-center"
                    >
                      <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-400">
                        ▤
                      </div>

                      <p className="text-sm font-medium text-slate-600">
                        Belum ada transaksi Incoming
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Data transaksi akan muncul di sini.
                      </p>
                    </td>
                  </tr>
                ) : (
                  transactions.map((item) => (
                    <tr
                      key={item.id}
                      className="transition-colors hover:bg-blue-50/30"
                    >
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">
                        {new Date(item.date).toLocaleDateString("id-ID")}
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-1 text-[11px] font-bold ${
                            item.product.type === "HT"
                              ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100"
                              : "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-100"
                          }`}
                        >
                          {item.product.type}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3.5 font-semibold text-slate-700">
                        {item.product.computerCode}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">
                        {item.product.partNo}
                      </td>

                      <td className="px-4 py-3.5 font-medium text-slate-700">
                        {item.product.productName}
                      </td>

                      <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-slate-800">
                        {formatNumber(item.quantity)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">
                        {item.responsible.name}
                      </td>

                      <td className="max-w-[180px] truncate px-4 py-3.5 text-slate-500">
                        {item.remark || "-"}
                      </td>

                      {isAdmin && (
                        <td className="px-4 py-3.5">
                          <div className="flex justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:border-amber-300 hover:bg-amber-100"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(item)}
                              className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-100"
                            >
                              Delete
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

          {/* Pagination */}
          <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-slate-500">
              Halaman{" "}
              <span className="font-semibold text-slate-700">{page}</span>{" "}
              dari{" "}
              <span className="font-semibold text-slate-700">
                {totalPages}
              </span>
            </span>

            <div className="flex gap-2">
              <button
                disabled={page <= 1 || loading}
                onClick={() => loadHistory(page - 1)}
                className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Sebelumnya
              </button>

              <button
                disabled={page >= totalPages || loading}
                onClick={() => loadHistory(page + 1)}
                className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Selanjutnya →
              </button>
            </div>
          </div>
        </div>

        {/* MODAL EDIT */}
        {editing && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[3px]"
            onClick={() => {
              if (!editSaving) setEditing(null);
            }}
          >
            <form
              onSubmit={handleEditSubmit}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                      Edit Data
                    </span>
                  </div>

                  <h2 className="text-lg font-bold text-slate-800">
                    Edit Incoming
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {editing.product.computerCode} —{" "}
                    {editing.product.productName}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  disabled={editSaving}
                  className="rounded-lg p-1.5 text-xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                >
                  ×
                </button>
              </div>

              {/* Modal Body */}
              <div className="space-y-4 p-6">
                <div>
                  <label className={labelClass}>Tanggal</label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Incoming Qty (PCS)</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Remark</label>
                  <textarea
                    rows={3}
                    value={editRemark}
                    onChange={(e) => setEditRemark(e.target.value)}
                    className={`${inputClass} resize-y`}
                    placeholder="Catatan (opsional)"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  disabled={editSaving}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={editSaving}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {editSaving ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }