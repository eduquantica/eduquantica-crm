import { config } from "dotenv"
config({ path: ".env" })
config({ path: ".env.local", override: true })

import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const email = "admin@eduquantica.com"
  const password = "Admin@123456" // change later after login

  console.log("Creating ADMIN user...")

  // ✅ Check if admin already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  })

  if (existingUser) {
    console.log("⚠️ Admin already exists.")
    return
  }

  // ✅ Hash password
  const hashedPassword = await bcrypt.hash(password, 10)

  // ✅ Create Admin User
  await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name: "System Admin",
      role: { connect: { name: "ADMIN" } },
    },
  })

  console.log("✅ Admin created successfully!")
  console.log("Email:", email)
  console.log("Password:", password)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })