import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../lib/auth-guard";
import { ProductType, AuditAction, Prisma } from "@prisma/client";

// ==========================================
// HELPER
// ==========================================

function isPrismaError(
  error: unknown,
  code: string
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

type ProductInput = {
  type?: unknown;
  computerCode?: unknown;
  partNo?: unknown;
  productName?: unknown;
  initialStock?: unknown;
};

function validateProduct(body: ProductInput) {
  const typeValue = String(body.type || "").trim();
  const computerCode = String(body.computerCode || "").trim();
  const partNo = String(body.partNo || "").trim();
  const productName = String(body.productName || "").trim();
  const initialStock = Number(body.initialStock);

  if (typeValue !== "HT" && typeValue !== "HK") {
    return {
      error: "Production Type harus HT atau HK",
    };
  }

  if (!computerCode || !partNo || !productName) {
    return {
      error:
        "Computer Code, Part No, dan Product Name wajib diisi",
    };
  }

  if (
    !Number.isSafeInteger(initialStock) ||
    initialStock < 0
  ) {
    return {
      error:
        "Initial Stock harus bilangan bulat minimal 0",
    };
  }

  return {
    data: {
      type: typeValue as ProductType,
      computerCode,
      partNo,
      productName,
      initialStock,
    },
  };
}

// ==========================================
// AUDIT HELPER
// ==========================================

function productAuditData(
  product: {
    id: string;
    type: ProductType;
    computerCode: string;
    partNo: string;
    productName: string;
    initialStock: number;
    isActive: boolean;
  }
) {
  return {
    id: product.id,
    type: product.type,
    computerCode: product.computerCode,
    partNo: product.partNo,
    productName: product.productName,
    initialStock: product.initialStock,
    isActive: product.isActive,
  };
}

// ==========================================
// GET PRODUCTS
// ==========================================

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);

    const search =
      searchParams.get("search")?.trim() || "";

    const type =
      searchParams.get("type") || "ALL";

    const status =
      searchParams.get("status") || "ACTIVE";

    const page = Math.max(
      1,
      Number(searchParams.get("page")) || 1
    );

    const limit = Math.min(
      100,
      Math.max(
        1,
        Number(searchParams.get("limit")) || 10
      )
    );

    const where: Prisma.ProductWhereInput = {};

    if (type === "HT" || type === "HK") {
      where.type = type;
    }

    if (status === "ACTIVE") {
      where.isActive = true;
    } else if (status === "INACTIVE") {
      where.isActive = false;
    }

    if (search) {
      where.OR = [
        {
          computerCode: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          partNo: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          productName: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: [
          { type: "asc" },
          { computerCode: "asc" },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),

      prisma.product.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(
      "GET PRODUCTS ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil data produk",
      },
      { status: 500 }
    );
  }
}

// ==========================================
// POST - CREATE PRODUCT
// ADMIN ONLY
// ==========================================

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Hanya Admin yang dapat menambahkan produk manual",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const validation =
      validateProduct(body);

    if (
      validation.error ||
      !validation.data
    ) {
      return NextResponse.json(
        {
          success: false,
          message: validation.error,
        },
        { status: 400 }
      );
    }

    const {
      type,
      computerCode,
      partNo,
      productName,
      initialStock,
    } = validation.data;

    const existingProduct =
      await prisma.product.findUnique({
        where: {
          type_computerCode: {
            type,
            computerCode,
          },
        },
      });

    if (existingProduct) {
      return NextResponse.json(
        {
          success: false,
          message: `Computer Code ${computerCode} sudah terdaftar untuk ${type}`,
        },
        { status: 409 }
      );
    }

    // ======================================
    // CREATE PRODUCT + AUDIT LOG
    // ATOMIC TRANSACTION
    // ======================================

    const product =
      await prisma.$transaction(
        async (tx) => {
          const created =
            await tx.product.create({
              data: {
                type,
                computerCode,
                partNo,
                productName,
                initialStock,
                isActive: true,
              },
            });

          await tx.auditLog.create({
            data: {
              action: AuditAction.CREATE,

              productId: created.id,
              actorId: user.id,

              entityType: "Product",
              entityId: created.id,

              oldData: Prisma.JsonNull,
              newData:
                productAuditData(created),

              description:
                `Admin ${user.name} membuat produk ${created.computerCode} (${created.type})`,
            },
          });

          return created;
        }
      );

    return NextResponse.json(
      {
        success: true,
        message:
          "Produk berhasil ditambahkan",
        data: product,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "POST PRODUCT ERROR:",
      error
    );

    if (
      isPrismaError(error, "P2002")
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Computer Code sudah terdaftar untuk Production Type tersebut",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal menambahkan produk",
      },
      { status: 500 }
    );
  }
}

// ==========================================
// PUT - EDIT PRODUCT
// ADMIN ONLY
// ==========================================

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Hanya Admin yang dapat mengedit produk",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const id =
      String(body.id || "").trim();

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID produk wajib diisi",
        },
        { status: 400 }
      );
    }

    const validation =
      validateProduct(body);

    if (
      validation.error ||
      !validation.data
    ) {
      return NextResponse.json(
        {
          success: false,
          message: validation.error,
        },
        { status: 400 }
      );
    }

    const {
      type,
      computerCode,
      partNo,
      productName,
      initialStock,
    } = validation.data;

    const existing =
      await prisma.product.findUnique({
        where: { id },
      });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Produk tidak ditemukan",
        },
        { status: 404 }
      );
    }

    const duplicate =
      await prisma.product.findFirst({
        where: {
          type,
          computerCode,
          NOT: { id },
        },
      });

    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          message: `Computer Code ${computerCode} sudah terdaftar untuk ${type}`,
        },
        { status: 409 }
      );
    }

    const oldData =
      productAuditData(existing);

    // Apakah Initial Stock berubah?
    const initialStockChanged =
      existing.initialStock !==
      initialStock;

    const updated =
      await prisma.$transaction(
        async (tx) => {
          const product =
            await tx.product.update({
              where: { id },
              data: {
                type,
                computerCode,
                partNo,
                productName,
                initialStock,
              },
            });

          // ==================================
          // AUDIT UPDATE
          // ==================================

          await tx.auditLog.create({
            data: {
              action: initialStockChanged
                ? AuditAction.INITIAL_STOCK_CHANGE
                : AuditAction.UPDATE,

              productId: product.id,
              actorId: user.id,

              entityType: "Product",
              entityId: product.id,

              oldData,
              newData:
                productAuditData(product),

              description:
                initialStockChanged
                  ? `Admin ${user.name} mengubah Initial Stock produk ${product.computerCode} dari ${existing.initialStock} menjadi ${product.initialStock} PCS`
                  : `Admin ${user.name} memperbarui data produk ${product.computerCode} (${product.type})`,
            },
          });

          return product;
        }
      );

    return NextResponse.json({
      success: true,
      message:
        initialStockChanged
          ? "Produk dan Initial Stock berhasil diperbarui"
          : "Produk berhasil diperbarui",
      data: updated,
    });
  } catch (error) {
    console.error(
      "PUT PRODUCT ERROR:",
      error
    );

    if (
      isPrismaError(error, "P2002")
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Computer Code sudah terdaftar untuk Production Type tersebut",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal memperbarui produk",
      },
      { status: 500 }
    );
  }
}

// ==========================================
// PATCH - ACTIVATE / DEACTIVATE
// ADMIN ONLY
// ==========================================

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Hanya Admin yang dapat mengubah status produk",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const id =
      String(body.id || "").trim();

    if (
      !id ||
      typeof body.isActive !==
        "boolean"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID dan status produk wajib diisi",
        },
        { status: 400 }
      );
    }

    const existing =
      await prisma.product.findUnique({
        where: { id },
      });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Produk tidak ditemukan",
        },
        { status: 404 }
      );
    }

    // Kalau status sama, tidak perlu
    // membuat audit log baru.
    if (
      existing.isActive ===
      body.isActive
    ) {
      return NextResponse.json({
        success: true,
        message: body.isActive
          ? "Produk sudah aktif"
          : "Produk sudah nonaktif",
        data: existing,
      });
    }

    const action =
      body.isActive
        ? AuditAction.ACTIVATE
        : AuditAction.DEACTIVATE;

    const updated =
      await prisma.$transaction(
        async (tx) => {
          const product =
            await tx.product.update({
              where: { id },
              data: {
                isActive:
                  body.isActive,
              },
            });

          await tx.auditLog.create({
            data: {
              action,

              productId: product.id,
              actorId: user.id,

              entityType: "Product",
              entityId: product.id,

              oldData:
                productAuditData(existing),

              newData:
                productAuditData(product),

              description:
                body.isActive
                  ? `Admin ${user.name} mengaktifkan produk ${product.computerCode} (${product.type})`
                  : `Admin ${user.name} menonaktifkan produk ${product.computerCode} (${product.type})`,
            },
          });

          return product;
        }
      );

    return NextResponse.json({
      success: true,
      message: body.isActive
        ? "Produk berhasil diaktifkan"
        : "Produk berhasil dinonaktifkan",
      data: updated,
    });
  } catch (error) {
    console.error(
      "PATCH PRODUCT ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal mengubah status produk",
      },
      { status: 500 }
    );
  }
}

// ==========================================
// DELETE - DELETE PRODUCT
// ADMIN ONLY
// ==========================================

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Hanya Admin yang dapat menghapus produk",
        },
        { status: 403 }
      );
    }

    const { searchParams } =
      new URL(request.url);

    const id =
      searchParams.get("id")?.trim();

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ID produk wajib diisi",
        },
        { status: 400 }
      );
    }

    const existing =
      await prisma.product.findUnique({
        where: { id },
        include: {
          incomingTransactions: {
            select: {
              id: true,
            },
            take: 1,
          },

          outgoingTransactions: {
            select: {
              id: true,
            },
            take: 1,
          },
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Produk tidak ditemukan",
        },
        { status: 404 }
      );
    }

    if (
      existing
        .incomingTransactions
        .length > 0 ||
      existing
        .outgoingTransactions
        .length > 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Produk sudah memiliki riwayat transaksi. Nonaktifkan produk jika tidak digunakan lagi.",
        },
        { status: 409 }
      );
    }

    const oldData =
      productAuditData(existing);

    // ======================================
    // AUDIT DELETE + DELETE PRODUCT
    // ======================================
    //
    // Karena productId memakai onDelete:
    // SetNull, audit log tetap aman setelah
    // product dihapus.
    //
    // Kita membuat AuditLog dahulu lalu
    // menghapus Product dalam transaction.
    // ======================================

    await prisma.$transaction(
      async (tx) => {
        await tx.auditLog.create({
          data: {
            action:
              AuditAction.DELETE,

            productId: existing.id,
            actorId: user.id,

            entityType: "Product",
            entityId: existing.id,

            oldData,
            newData: Prisma.JsonNull,

            description:
              `Admin ${user.name} menghapus produk ${existing.computerCode} (${existing.type})`,
          },
        });

        await tx.product.delete({
          where: {
            id: existing.id,
          },
        });
      }
    );

    return NextResponse.json({
      success: true,
      message:
        "Produk berhasil dihapus",
    });
  } catch (error) {
    console.error(
      "DELETE PRODUCT ERROR:",
      error
    );

    if (
      isPrismaError(error, "P2003")
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Produk memiliki data terkait dan tidak dapat dihapus",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal menghapus produk",
      },
      { status: 500 }
    );
  }
}