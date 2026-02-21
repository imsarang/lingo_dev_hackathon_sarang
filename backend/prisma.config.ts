import { defineConfig } from "prisma/config"
import "dotenv/config"

export default defineConfig({
  schema: "src/db/prima/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
