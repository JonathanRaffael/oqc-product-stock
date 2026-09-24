import { NextRequest, NextResponse } from "next/server";
import { AuditAction, UserRole } from "@prisma/client";

import { prisma } from "../../lib/prisma";
import { getSession } from "../../lib/auth";

const VALID_ACTIONS = Object.values(AuditAction);

export async function GET(request: NextRequest) {
  try {
    // ==========================================
    // 1. AUTHENTICATION
    // ==========================================

    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized. Silakan login terlebih dahulu.",
        },
        { status: 401 }
      );
    }

    // ==========================================
    // 2. VALIDATE USER
    // ==========================================

    const currentUser = await prisma.user.findUnique({
      where: {
        id: session.id,
      },
      select: {
        id: true,
        role: true,
        isActive: true,
      },
    });

    if (!currentUser || !currentUser.isActive) {
      return NextResponse.json(
        {
          success: false,
          message: "Akun tidak aktif atau tidak ditemukan.",
        },
        { status: 401 }
      );
    }

    // ==========================================
    // 3. ADMIN ONLY
    // ==========================================

    if (currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json(
        {
          success: false,
          message: "Forbidden. Hanya Admin yang dapat melihat Audit Log.",
        },
        { status: 403 }
      );
    }

    // ==========================================
    // 4. QUERY PARAMETERS
    // ==========================================

    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search")?.trim() || "";
    const entityType = searchParams.get("entityType") || "";
    const action = searchParams.get("action") || "";

    const page = Math.max(
      1,
      Number.parseInt(searchParams.get("page") || "1", 10) || 1
    );

    const limit = Math.min(
      100,
      Math.max(
        1,
        Number.parseInt(searchParams.get("limit") || "20", 10) || 20
      )
    );

    // ==========================================
    // 5. VALIDATE ACTION FILTER
    // ==========================================

    if (action && !VALID_ACTIONS.includes(action as AuditAction)) {
      return NextResponse.json(
        {
          success: false,
          message: "Filter action tidak valid.",
        },
        { status: 400 }
      );
    }

    // ==========================================
    // 6. BUILD WHERE CONDITION
    // ==========================================

    const where = {
      ...(entityType
        ? {
            entityType: {
              equals: entityType,
              mode: "insensitive" as const,
            },
          }
        : {}),

      ...(action
        ? {
            action: action as AuditAction,
          }
        : {}),

      ...(search
        ? {
            OR: [
              {
                description: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                entityType: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                entityId: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                actor: {
                  is: {
                    name: {
                      contains: search,
                      mode: "insensitive" as const,
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    // ==========================================
    // 7. FETCH DATA
    // ==========================================

    const [total, logs] = await prisma.$transaction([
      prisma.auditLog.count({
        where,
      }),

      prisma.auditLog.findMany({
        where,

        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },

          product: {
            select: {
              id: true,
              type: true,
              computerCode: true,
              partNo: true,
              productName: true,
            },
          },
        },

        orderBy: {
          createdAt: "desc",
        },

        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // ==========================================
    // 8. RESPONSE
    // ==========================================

    return NextResponse.json({
      success: true,

      data: logs,

      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET AUDIT LOG ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Terjadi kesalahan saat mengambil Audit Log.",
      },
      { status: 500 }
    );
  }
}