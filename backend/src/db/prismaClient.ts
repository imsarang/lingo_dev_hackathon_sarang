import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

// Create PostgreSQL connection pool
const connectionString = process.env.DATABASE_URL
if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
}

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)

// Prisma 7 requires adapter for PostgreSQL
export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
