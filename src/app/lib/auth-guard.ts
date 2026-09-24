import { redirect } from "next/navigation";
import { getSession } from "../lib/auth";
import { prisma } from "../lib/prisma";

export async function requireAuth() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Pastikan akun masih aktif di database
  const user = await prisma.user.findUnique({
    where: {
      id: session.id,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    redirect("/api/auth/logout");
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();

  if (user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return user;
}