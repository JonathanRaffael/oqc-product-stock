import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL belum diatur di .env");
}

// Hilangkan konfigurasi SSL dari URL agar tidak bentrok
const url = new URL(databaseUrl);

url.searchParams.delete("sslmode");
url.searchParams.delete("sslrootcert");
url.searchParams.delete("sslcert");
url.searchParams.delete("sslkey");

// Baca CA certificate Aiven
const caPath = path.join(process.cwd(), "ca.pem");

if (!fs.existsSync(caPath)) {
  throw new Error("File ca.pem tidak ditemukan di root project");
}

const ca = fs.readFileSync(caPath, "utf8");

// Prisma 7 + PostgreSQL adapter
const adapter = new PrismaPg({
  connectionString: url.toString(),
  ssl: {
    ca,
    rejectUnauthorized: true,
  },
});

const prisma = new PrismaClient({ adapter });

async function main() {
  // Password diambil dari .env
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
  const userPassword = process.env.USER_INITIAL_PASSWORD;

  if (!adminPassword || !userPassword) {
    throw new Error(
      "ADMIN_INITIAL_PASSWORD dan USER_INITIAL_PASSWORD wajib diatur di .env"
    );
  }

  // Hash password menggunakan bcrypt
  const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
  const userPasswordHash = await bcrypt.hash(userPassword, 12);

  // Buat akun Admin
  await prisma.user.upsert({
    where: {
      email: "admin@htm.com",
    },
    update: {},
    create: {
      name: "Administrator",
      email: "admin@htm.com",
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  // Buat akun User OQC
  await prisma.user.upsert({
    where: {
      email: "oqc@htm.com",
    },
    update: {},
    create: {
      name: "OQC User",
      email: "oqc@htm.com",
      passwordHash: userPasswordHash,
      role: UserRole.USER,
      isActive: true,
    },
  });

  console.log("================================");
  console.log("SEED USER BERHASIL");
  console.log("Admin : admin@htm.com");
  console.log("User  : oqc@htm.com");
  console.log("================================");
}

main()
  .catch((error) => {
    console.error("SEED USER GAGAL:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });