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

// Ambil sertifikat CA dari Environment Variable Vercel
let ca = process.env.DATABASE_CA_CERT;

// Jika tidak ada env, coba baca file CA lokal (untuk development)
if (!ca) {
  const caPath = path.join(process.cwd(), "ca.pem");

  if (fs.existsSync(caPath)) {
    ca = fs.readFileSync(caPath, "utf8");
  }
}

// Pastikan sertifikat tersedia
if (!ca) {
  throw new Error(
    "CA certificate tidak ditemukan. Atur DATABASE_CA_CERT di Environment Variables."
  );
}

// Mengubah literal \n menjadi newline jika diperlukan
ca = ca.replace(/\\n/g, "\n");

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