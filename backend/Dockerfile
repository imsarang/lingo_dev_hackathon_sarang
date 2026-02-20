FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3000

# Environment variables should be set at runtime:
# - REDIS_URL (default: redis://localhost:6379)
# - CHROMA_URL (default: http://localhost:8000)
# - AWS_ACCESS_KEY_ID (required)
# - AWS_SECRET_ACCESS_KEY (required)
# - HUGGINGFACE_API_KEY (required)
# - HUGGINGFACE_MODEL (optional, defaults to meta-llama/Meta-Llama-3-8B-Instruct)

# Start the application
CMD ["node", "dist/server.js"]
