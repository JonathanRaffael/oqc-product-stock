import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL belum diatur");
}

const url = new URL(databaseUrl);

// Hapus parameter SSL dari URL agar tidak bentrok
url.searchParams.delete("sslmode");
url.searchParams.delete("sslrootcert");
url.searchParams.delete("sslcert");
url.searchParams.delete("sslkey");

const caPath = path.join(process.cwd(), "ca.pem");

if (!fs.existsSync(caPath)) {
  throw new Error(`File CA tidak ditemukan: ${caPath}`);
}

const ca = fs.readFileSync(caPath, "utf8");

const adapter = new PrismaPg({
  connectionString: url.toString(),
  ssl: {
    ca,
    rejectUnauthorized: true,
  },
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}