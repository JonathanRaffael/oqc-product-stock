import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../lib/auth-guard";
import { ProductType, Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search")?.trim() || "";
    const type = searchParams.get("type") || "ALL";

    const page = Math.max(
      1,
      Number(searchParams.get("page") || 1)
    );

    const limit = Math.min(
      100,
      Math.max(1, Number(searchParams.get("limit") || 10))
    );

    const where: Prisma.ProductWhereInput = {
      ...(type !== "ALL" && {
        type: type as ProductType,
      }),

      ...(search && {
        OR: [
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
        ],
      }),
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { computerCode: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),

      prisma.product.count({ where }),
    ]);

    const productIds = products.map((p) => p.id);

    const [incomingTotals, outgoingTotals] = await Promise.all([
      prisma.incoming.groupBy({
        by: ["productId"],
        where: {
          productId: { in: productIds },
        },
        _sum: {
          quantity: true,
        },
      }),

      prisma.outgoing.groupBy({
        by: ["productId"],
        where: {
          productId: { in: productIds },
        },
        _sum: {
          quantityOut: true,
          ng: true,
          spare: true,
        },
      }),
    ]);

    const incomingMap = new Map(
      incomingTotals.map((item) => [
        item.productId,
        item._sum.quantity ?? 0,
      ])
    );

    const outgoingMap = new Map(
      outgoingTotals.map((item) => [
        item.productId,
        {
          outgoing: item._sum.quantityOut ?? 0,
          ng: item._sum.ng ?? 0,
          spare: item._sum.spare ?? 0,
        },
      ])
    );

    const data = products.map((product) => {
      const incoming = incomingMap.get(product.id) ?? 0;

      const out = outgoingMap.get(product.id) ?? {
        outgoing: 0,
        ng: 0,
        spare: 0,
      };

      const finalStock =
        product.initialStock +
        incoming -
        out.outgoing -
        out.ng -
        out.spare;

      return {
        id: product.id,
        type: product.type,
        computerCode: product.computerCode,
        partNo: product.partNo,
        productName: product.productName,
        initialStock: product.initialStock,
        incoming,
        outgoing: out.outgoing,
        ng: out.ng,
        spare: out.spare,
        finalStock,
        isActive: product.isActive,
      };
    });

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
    console.error("Dashboard API Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil data Dashboard",
      },
      { status: 500 }
    );
  }
}