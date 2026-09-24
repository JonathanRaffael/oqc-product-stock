import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma, UserRole } from "@prisma/client";

import { prisma } from "../../lib/prisma";
import { requireAdmin } from "../../lib/auth-guard";

const VALID_ROLES = ["ADMIN", "USER"] as const;

function errorResponse(message: string, status = 400) {
  return NextResponse.json(
    { success: false, message },
    { status }
  );
}

// Type guard untuk menangani error tanpa any
function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.startsWith("NEXT_REDIRECT")
  );
}

function isPrismaError(
  error: unknown,
  code: string
): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === code
  );
}

// GET: Daftar user
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search")?.trim() || "";
    const role = searchParams.get("role") || "ALL";
    const status = searchParams.get("status") || "ALL";

    const page = Math.max(
      1,
      Number.parseInt(searchParams.get("page") || "1", 10) || 1
    );

    const limit = Math.min(
      100,
      Math.max(
        1,
        Number.parseInt(searchParams.get("limit") || "10", 10) || 10
      )
    );

    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (role === "ADMIN" || role === "USER") {
      where.role = role as UserRole;
    }

    if (status === "ACTIVE") {
      where.isActive = true;
    } else if (status === "INACTIVE") {
      where.isActive = false;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    if (isRedirectError(error)) {
      throw error;
    }

    console.error("GET /api/users error:", error);

    return errorResponse("Gagal mengambil data user", 500);
  }
}

// POST: Tambah user
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const role = String(body.role || "USER");

    if (!name || !email || !password) {
      return errorResponse("Nama, email, dan password wajib diisi");
    }

    if (password.length < 8) {
      return errorResponse("Password minimal 8 karakter");
    }

    if (!VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
      return errorResponse("Role tidak valid");
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return errorResponse("Email sudah terdaftar");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: role as UserRole,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "User berhasil ditambahkan",
      data: user,
    });
  } catch (error: unknown) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (isPrismaError(error, "P2002")) {
      return errorResponse("Email sudah terdaftar", 409);
    }

    console.error("POST /api/users error:", error);

    return errorResponse("Gagal menambahkan user", 500);
  }
}

// PUT: Edit user
export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();

    const id = String(body.id || "").trim();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "");

    if (!id || !name || !email || !role) {
      return errorResponse("ID, nama, email, dan role wajib diisi");
    }

    if (!VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
      return errorResponse("Role tidak valid");
    }

    if (id === admin.id && role !== "ADMIN") {
      return errorResponse("Kamu tidak bisa menurunkan role akun sendiri");
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!targetUser) {
      return errorResponse("User tidak ditemukan", 404);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        name,
        email,
        role: role as UserRole,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Data user berhasil diperbarui",
      data: updatedUser,
    });
  } catch (error: unknown) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (isPrismaError(error, "P2002")) {
      return errorResponse("Email sudah digunakan user lain", 409);
    }

    console.error("PUT /api/users error:", error);

    return errorResponse("Gagal memperbarui user", 500);
  }
}

// PATCH: Aktifkan / nonaktifkan user
export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();

    const id = String(body.id || "").trim();

    if (!id || typeof body.isActive !== "boolean") {
      return errorResponse("ID dan status akun wajib diisi");
    }

    if (id === admin.id && body.isActive === false) {
      return errorResponse("Kamu tidak bisa menonaktifkan akun sendiri");
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!targetUser) {
      return errorResponse("User tidak ditemukan", 404);
    }

    const user = await prisma.user.update({
      where: { id },
      data: { isActive: body.isActive },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: body.isActive
        ? "Akun berhasil diaktifkan"
        : "Akun berhasil dinonaktifkan",
      data: user,
    });
  } catch (error: unknown) {
    if (isRedirectError(error)) {
      throw error;
    }

    console.error("PATCH /api/users error:", error);

    return errorResponse("Gagal mengubah status user", 500);
  }
}

// DELETE: Hapus user
export async function DELETE(request: NextRequest) {
  try {
    const admin = await requireAdmin();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim();

    if (!id) {
      return errorResponse("ID user wajib diisi");
    }

    if (id === admin.id) {
      return errorResponse("Kamu tidak bisa menghapus akun sendiri");
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        _count: {
          select: {
            incomingTransactions: true,
            outgoingTransactions: true,
          },
        },
      },
    });

    if (!targetUser) {
      return errorResponse("User tidak ditemukan", 404);
    }

    const transactionCount =
      targetUser._count.incomingTransactions +
      targetUser._count.outgoingTransactions;

    if (transactionCount > 0) {
      return errorResponse(
        "User memiliki riwayat transaksi dan tidak bisa dihapus. Nonaktifkan akun saja."
      );
    }

    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "User berhasil dihapus",
    });
  } catch (error: unknown) {
    if (isRedirectError(error)) {
      throw error;
    }

    console.error("DELETE /api/users error:", error);

    return errorResponse("Gagal menghapus user", 500);
  }
}