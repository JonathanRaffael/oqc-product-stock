import { NextRequest, NextResponse } from "next/server";
import { ProductType, UserRole, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../lib/auth-guard";

function errorResponse(message: string, status = 400) {
  return NextResponse.json(
    { success: false, message },
    { status }
  );
}

function isValidType(value: string): value is "HT" | "HK" {
  return value === "HT" || value === "HK";
}

// GET: Riwayat Incoming
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search")?.trim() || "";
    const type = searchParams.get("type") || "ALL";

    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number(searchParams.get("limit")) || 10)
    );

    const where: Prisma.IncomingWhereInput = {};

    if (type === "HT" || type === "HK") {
      where.product = { type };
    }

    if (search) {
      where.OR = [
        {
          product: {
            computerCode: { contains: search, mode: "insensitive" },
          },
        },
        {
          product: {
            partNo: { contains: search, mode: "insensitive" },
          },
        },
        {
          product: {
            productName: { contains: search, mode: "insensitive" },
          },
        },
        {
          responsible: {
            name: { contains: search, mode: "insensitive" },
          },
        },
      ];
    }

    const [transactions, total] = await Promise.all([
      prisma.incoming.findMany({
        where,
        include: {
          product: true,
          responsible: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { date: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.incoming.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET INCOMING ERROR:", error);
    return errorResponse("Gagal mengambil riwayat Incoming", 500);
  }
}

// POST: Tambah Incoming
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const computerCode = String(body.computerCode || "").trim();
    const typeValue = String(body.type || "").trim();

    if (!isValidType(typeValue)) {
      return errorResponse("Production Type harus HT atau HK");
    }

    const type = typeValue as ProductType;
    const quantity = Number(body.quantity);
    const remark = String(body.remark || "").trim();
    const date = body.date ? new Date(body.date) : new Date();

    if (!computerCode) {
      return errorResponse("Computer Code wajib diisi");
    }

    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      return errorResponse(
        "Incoming Qty harus bilangan bulat lebih dari 0"
      );
    }

    if (Number.isNaN(date.getTime())) {
      return errorResponse("Tanggal transaksi tidak valid");
    }

    const product = await prisma.product.findUnique({
      where: {
        type_computerCode: {
          type,
          computerCode,
        },
      },
    });

    if (!product) {
      return errorResponse(
        "Produk tidak ditemukan di Product Master",
        404
      );
    }

    if (!product.isActive) {
      return errorResponse("Produk sudah nonaktif");
    }

    const transaction = await prisma.incoming.create({
      data: {
        date,
        productId: product.id,
        quantity,
        responsibleId: user.id,
        remark: remark || null,
      },
      include: {
        product: true,
        responsible: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Incoming berhasil disimpan",
      data: transaction,
    });
  } catch (error) {
    console.error("POST INCOMING ERROR:", error);
    return errorResponse("Gagal menyimpan Incoming", 500);
  }
}

// PUT: Edit Incoming (Admin Only)
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role !== UserRole.ADMIN) {
      return errorResponse(
        "Hanya Admin yang dapat mengedit Incoming",
        403
      );
    }

    const body = await request.json();

    const id = String(body.id || "").trim();
    const quantity = Number(body.quantity);
    const remark = String(body.remark || "").trim();
    const date = body.date ? new Date(body.date) : null;

    if (!id) {
      return errorResponse("ID transaksi wajib diisi");
    }

    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      return errorResponse(
        "Incoming Qty harus bilangan bulat lebih dari 0"
      );
    }

    if (!date || Number.isNaN(date.getTime())) {
      return errorResponse("Tanggal transaksi tidak valid");
    }

    const existing = await prisma.incoming.findUnique({
      where: { id },
    });

    if (!existing) {
      return errorResponse(
        "Transaksi Incoming tidak ditemukan",
        404
      );
    }

    const updated = await prisma.incoming.update({
      where: { id },
      data: {
        quantity,
        date,
        remark: remark || null,
      },
      include: {
        product: true,
        responsible: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Incoming berhasil diperbarui",
      data: updated,
    });
  } catch (error) {
    console.error("PUT INCOMING ERROR:", error);
    return errorResponse("Gagal memperbarui Incoming", 500);
  }
}

// DELETE: Hapus Incoming (Admin Only) + Audit Log
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role !== UserRole.ADMIN) {
      return errorResponse(
        "Hanya Admin yang dapat menghapus Incoming",
        403
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim();

    if (!id) {
      return errorResponse("ID transaksi wajib diisi");
    }

    await prisma.$transaction(async (tx) => {
      // Ambil data Incoming sebelum dihapus
      const existing = await tx.incoming.findUnique({
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
        throw new Error("INCOMING_NOT_FOUND");
      }

      // Simpan snapshot data sebelum penghapusan
      const oldData = {
        id: existing.id,
        date: existing.date.toISOString(),
        productId: existing.productId,
        computerCode: existing.product.computerCode,
        partNo: existing.product.partNo,
        productName: existing.product.productName,
        type: existing.product.type,
        quantity: existing.quantity,
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

      // Catat Audit Log sebelum menghapus transaksi
      await tx.auditLog.create({
        data: {
          action: "DELETE",
          entityType: "INCOMING",
          entityId: existing.id,
          productId: existing.productId,
          actorId: user.id,
          oldData: oldData as Prisma.InputJsonValue,
          newData: Prisma.JsonNull,
          description: `Menghapus Incoming ${existing.product.computerCode} sebanyak ${existing.quantity} PCS`,
        },
      });

      // Hapus transaksi Incoming
      await tx.incoming.delete({
        where: { id },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Incoming berhasil dihapus dan dicatat di Audit Log",
    });
  } catch (error) {
    console.error("DELETE INCOMING ERROR:", error);

    if (
      error instanceof Error &&
      error.message === "INCOMING_NOT_FOUND"
    ) {
      return errorResponse(
        "Transaksi Incoming tidak ditemukan",
        404
      );
    }

    return errorResponse("Gagal menghapus Incoming", 500);
  }
}