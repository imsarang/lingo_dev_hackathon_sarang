FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy Prisma schema and generate client
COPY src/db/prima/schema.prisma ./src/db/prima/schema.prisma
RUN npx prisma generate --schema=./src/db/prima/schema.prisma

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3001

# Start the application
CMD ["node", "dist/server.js"]
