# PostgreSQL Database Setup

## DATABASE_URL Format

For PostgreSQL, use the following format in your `.env` file:

```env
DATABASE_URL="postgresql://username:password@host:port/database?schema=public"
```

### Examples:

**Local PostgreSQL:**
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/lingo_dev?schema=public"
```

**PostgreSQL with SSL (Production/Cloud):**
```env
DATABASE_URL="postgresql://user:password@host.example.com:5432/dbname?schema=public&sslmode=require"
```

**PostgreSQL on Docker:**
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lingo_dev?schema=public"
```

## Automatic Database & Table Creation

The server automatically creates tables when it starts if they don't exist. This is handled by the `initializeDatabase()` function in `src/db/init.ts`.

### Manual Commands

If you need to manually create/update the database schema:

```bash
# Push schema to database (creates/updates tables)
npm run db:push

# Generate Prisma Client
npm run db:generate

# Create a migration (for production)
npm run db:migrate

# Open Prisma Studio (database GUI)
npm run db:studio
```

## Setup Steps

1. **Install PostgreSQL** (if not already installed)
   ```bash
   # Ubuntu/Debian
   sudo apt-get install postgresql postgresql-contrib
   
   # macOS (with Homebrew)
   brew install postgresql
   brew services start postgresql
   ```

2. **Create Database** (if it doesn't exist)
   ```bash
   # Connect to PostgreSQL
   psql -U postgres
   
   # Create database
   CREATE DATABASE lingo_dev;
   
   # Exit
   \q
   ```

3. **Set DATABASE_URL in .env**
   ```env
   DATABASE_URL="postgresql://postgres:your_password@localhost:5432/lingo_dev?schema=public"
   ```

4. **Start the server** - Tables will be created automatically
   ```bash
   npm run dev
   ```

## Notes

- The `pg` package is already installed (required for PostgreSQL)
- Tables are created automatically on server start
- For production, use migrations instead of `db push`: `npm run db:migrate`
- The schema file is located at: `src/db/prima/schema.prisma`
