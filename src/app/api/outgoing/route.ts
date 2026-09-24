import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../lib/auth-guard";
import { ProductType, Prisma, UserRole } from "@prisma/client";

const validNumber = (value: number) =>
  Number.isSafeInteger(value) && value >= 0;

function isValidType(value: unknown): value is ProductType {
  return value === "HT" || value === "HK";
}

function getOutgoingTotal(
  quantityOut: number,
  ng: number,
  spare: number
) {
  return quantityOut + ng + spare;
}

// GET: Riwayat Outgoing
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search")?.trim() || "";
    const type = searchParams.get("type") || "ALL";

    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(
      100,
      Math.max(1, Number(searchParams.get("limit") || 10))
    );

    const where: Prisma.OutgoingWhereInput = {
      ...(type !== "ALL" && {
        product: {
          type: type as ProductType,
        },
      }),

      ...(search && {
        OR: [
          {
            product: {
              computerCode: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
          {
            product: {
              partNo: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
          {
            product: {
              productName: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      prisma.outgoing.findMany({
        where,
        include: {
          product: true,
          responsible: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          date: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
      }),

      prisma.outgoing.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Outgoing GET Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil data Outgoing",
      },
      { status: 500 }
    );
  }
}

// POST: Tambah Outgoing
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const typeValue = body.type;
    const computerCode = String(body.computerCode || "").trim();

    const quantityOut = Number(body.quantityOut);
    const ng = Number(body.ng ?? 0);
    const spare = Number(body.spare ?? 0);

    const remark = body.remark ? String(body.remark).trim() : null;
    const date = body.date ? new Date(body.date) : new Date();

    if (!isValidType(typeValue)) {
      return NextResponse.json(
        { success: false, message: "Type harus HT atau HK" },
        { status: 400 }
      );
    }

    if (!computerCode) {
      return NextResponse.json(
        { success: false, message: "Computer Code wajib diisi" },
        { status: 400 }
      );
    }

    if (
      !validNumber(quantityOut) ||
      !validNumber(ng) ||
      !validNumber(spare) ||
      getOutgoingTotal(quantityOut, ng, spare) <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Qty Out, NG, dan Spare harus bilangan bulat nonnegatif, dengan total lebih dari 0",
        },
        { status: 400 }
      );
    }

    if (Number.isNaN(date.getTime())) {
      return NextResponse.json(
        { success: false, message: "Tanggal tidak valid" },
        { status: 400 }
      );
    }

    const type = typeValue;

    const product = await prisma.product.findUnique({
      where: {
        type_computerCode: {
          type,
          computerCode,
        },
      },
    });

    if (!product || !product.isActive) {
      return NextResponse.json(
        {
          success: false,
          message: "Produk tidak ditemukan atau tidak aktif",
        },
        { status: 404 }
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT id
          FROM products
          WHERE id = ${product.id}
          FOR UPDATE
        `;

        const [incomingAgg, outgoingAgg] = await Promise.all([
          tx.incoming.aggregate({
            where: { productId: product.id },
            _sum: { quantity: true },
          }),

          tx.outgoing.aggregate({
            where: { productId: product.id },
            _sum: {
              quantityOut: true,
              ng: true,
              spare: true,
            },
          }),
        ]);

        const incoming = incomingAgg._sum.quantity ?? 0;

        const alreadyOut =
          (outgoingAgg._sum.quantityOut ?? 0) +
          (outgoingAgg._sum.ng ?? 0) +
          (outgoingAgg._sum.spare ?? 0);

        const availableStock =
          product.initialStock + incoming - alreadyOut;

        const requested = getOutgoingTotal(quantityOut, ng, spare);

        if (requested > availableStock) {
          throw new Error(
            `STOCK_INSUFFICIENT: Stok tersedia ${availableStock} PCS, sedangkan total pengeluaran ${requested} PCS`
          );
        }

        return tx.outgoing.create({
          data: {
            date,
            productId: product.id,
            quantityOut,
            ng,
            spare,
            responsibleId: session.id,
            remark,
          },
          include: {
            product: true,
            responsible: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      }
    );

    return NextResponse.json(
      {
        success: true,
        message: "Outgoing berhasil disimpan",
        data: result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Outgoing POST Error:", error);

    if (
      error instanceof Error &&
      error.message.startsWith("STOCK_INSUFFICIENT:")
    ) {
      return NextResponse.json(
        {
          success: false,
          message: error.message.replace("STOCK_INSUFFICIENT: ", ""),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Gagal menyimpan transaksi Outgoing",
      },
      { status: 500 }
    );
  }
}

// PUT: Edit Outgoing (Admin only)
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth();

    if (session.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { success: false, message: "Akses ditolak. Khusus Admin." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const id = String(body.id || "").trim();
    const quantityOut = Number(body.quantityOut);
    const ng = Number(body.ng ?? 0);
    const spare = Number(body.spare ?? 0);
    const remark = body.remark ? String(body.remark).trim() : null;
    const date = body.date ? new Date(body.date) : new Date();

    if (!id) {
      return NextResponse.json(
        { success: false, message: "ID transaksi wajib diisi" },
        { status: 400 }
      );
    }

    if (
      !validNumber(quantityOut) ||
      !validNumber(ng) ||
      !validNumber(spare) ||
      getOutgoingTotal(quantityOut, ng, spare) <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Qty Out, NG, dan Spare harus bilangan bulat nonnegatif, dengan total lebih dari 0",
        },
        { status: 400 }
      );
    }

    if (Number.isNaN(date.getTime())) {
      return NextResponse.json(
        { success: false, message: "Tanggal tidak valid" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.outgoing.findUnique({
          where: { id },
        });

        if (!existing) {
          throw new Error("OUTGOING_NOT_FOUND");
        }

        // Kunci produk agar pengecekan stok konsisten
        await tx.$queryRaw`
          SELECT id
          FROM products
          WHERE id = ${existing.productId}
          FOR UPDATE
        `;

        const [product, incomingAgg, outgoingAgg] = await Promise.all([
          tx.product.findUnique({
            where: { id: existing.productId },
          }),

          tx.incoming.aggregate({
            where: { productId: existing.productId },
            _sum: { quantity: true },
          }),

          // Kecualikan transaksi yang sedang diedit
          tx.outgoing.aggregate({
            where: {
              productId: existing.productId,
              NOT: { id },
            },
            _sum: {
              quantityOut: true,
              ng: true,
              spare: true,
            },
          }),
        ]);

        if (!product) {
          throw new Error("PRODUCT_NOT_FOUND");
        }

        const incoming = incomingAgg._sum.quantity ?? 0;

        const alreadyOut =
          (outgoingAgg._sum.quantityOut ?? 0) +
          (outgoingAgg._sum.ng ?? 0) +
          (outgoingAgg._sum.spare ?? 0);

        const availableStock =
          product.initialStock + incoming - alreadyOut;

        const requested = getOutgoingTotal(quantityOut, ng, spare);

        if (requested > availableStock) {
          throw new Error(
            `STOCK_INSUFFICIENT: Stok tersedia ${availableStock} PCS, sedangkan total pengeluaran baru ${requested} PCS`
          );
        }

        return tx.outgoing.update({
          where: { id },
          data: {
            date,
            quantityOut,
            ng,
            spare,
            remark,
          },
          include: {
            product: true,
            responsible: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      }
    );

    return NextResponse.json({
      success: true,
      message: "Transaksi Outgoing berhasil diperbarui",
      data: result,
    });
  } catch (error) {
    console.error("Outgoing PUT Error:", error);

    if (
      error instanceof Error &&
      error.message.startsWith("STOCK_INSUFFICIENT:")
    ) {
      return NextResponse.json(
        {
          success: false,
          message: error.message.replace("STOCK_INSUFFICIENT: ", ""),
        },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === "OUTGOING_NOT_FOUND") {
      return NextResponse.json(
        { success: false, message: "Transaksi Outgoing tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Gagal memperbarui transaksi Outgoing",
      },
      { status: 500 }
    );
  }
}

// DELETE: Hapus Outgoing (Admin only) + Audit Log
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuth();

    if (session.role !== UserRole.ADMIN) {
      return NextResponse.json(
        {
          success: false,
          message: "Akses ditolak. Khusus Admin.",
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim();

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "ID transaksi wajib diisi",
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // Ambil data Outgoing sebelum dihapus
      const existing = await tx.outgoing.findUnique({
        where: { id },
        include: {
          product: true,
          responsible: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!existing) {
        throw new Error("OUTGOING_NOT_FOUND");
      }

      // Snapshot data transaksi sebelum penghapusan
      const oldData = {
        id: existing.id,
        date: existing.date.toISOString(),
        productId: existing.productId,
        computerCode: existing.product.computerCode,
        partNo: existing.product.partNo,
        productName: existing.product.productName,
        type: existing.product.type,
        quantityOut: existing.quantityOut,
        ng: existing.ng,
        spare: existing.spare,
        totalDeduction:
          existing.quantityOut + existing.ng + existing.spare,
        unit: "PCS",
        remark: existing.remark,
        responsible: existing.responsible
          ? {
              id: existing.responsible.id,
              name: existing.responsible.name,
              email: existing.responsible.email,
            }
          : null,
      };

      // Catat Audit Log
      await tx.auditLog.create({
        data: {
          action: "DELETE",
          entityType: "OUTGOING",
          entityId: existing.id,
          productId: existing.productId,
          actorId: session.id,
          oldData: oldData as Prisma.InputJsonValue,
          newData: Prisma.JsonNull,
          description: `Menghapus Outgoing ${existing.product.computerCode} (Qty Out: ${existing.quantityOut}, NG: ${existing.ng}, Spare: ${existing.spare})`,
        },
      });

      // Hapus transaksi Outgoing
      await tx.outgoing.delete({
        where: { id },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Outgoing berhasil dihapus dan dicatat di Audit Log",
    });
  } catch (error) {
    console.error("Outgoing DELETE Error:", error);

    if (
      error instanceof Error &&
      error.message === "OUTGOING_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Transaksi Outgoing tidak ditemukan",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Gagal menghapus transaksi Outgoing",
      },
      { status: 500 }
    );
  }
}