import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "../app/lib/prisma";

type CreateAuditLogParams = {
  action: AuditAction;

  actorId?: string | null;
  productId?: string | null;

  entityType: string;
  entityId?: string | null;

  oldData?: unknown;
  newData?: unknown;

  description?: string | null;
};

function toJson(
  data: unknown
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (data === undefined || data === null) {
    return Prisma.JsonNull;
  }

  return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
}

export async function createAuditLog({
  action,
  actorId,
  productId,
  entityType,
  entityId,
  oldData,
  newData,
  description,
}: CreateAuditLogParams) {
  return prisma.auditLog.create({
    data: {
      action,

      actorId: actorId ?? null,
      productId: productId ?? null,

      entityType,
      entityId: entityId ?? null,

      oldData: toJson(oldData),
      newData: toJson(newData),

      description: description ?? null,
    },
  });
}