# GitHub Actions Secrets Required for Backend

## Required Secrets

These secrets are **mandatory** and the application will fail to start without them:

### 1. AWS Credentials (Required)
- `AWS_ACCESS_KEY_ID` - AWS access key for S3 operations
- `AWS_SECRET_ACCESS_KEY` - AWS secret key for S3 operations
- `AWS_REGION` - AWS region (default: `us-east-1`)

### 2. HuggingFace API (Required)
- `HUGGINGFACE_API_KEY` - HuggingFace API key for LLM inference
  - Alternative: `HF_TOKEN` (if using HF_TOKEN instead)
- `HUGGINGFACE_MODEL` - Model identifier (optional, defaults to `meta-llama/Meta-Llama-3-8B-Instruct`)
  - Example: `meta-llama/Meta-Llama-3-8B-Instruct`

### 3. Docker Hub (Required for CI/CD)
- `DOCKERHUB_USERNAME` - Docker Hub username
- `DOCKERHUB_TOKEN` - Docker Hub access token

## Optional Secrets (with defaults)

These have default values but can be overridden:

### 4. Redis (Optional - defaults to localhost)
- `REDIS_URL` - Redis connection URL (default: `redis://localhost:6379`)
  - Used for: Session storage and caching

### 5. ChromaDB (Optional - defaults to localhost)
- `CHROMA_URL` - ChromaDB server URL (default: `http://localhost:8000`)
- `CHROMA_COLLECTION_NAME` - Collection name (default: `lingo-dev-collection`)

### 6. Server Configuration (Optional)
- `PORT` - Server port (default: `3000`)
- `NODE_ENV` - Environment (default: `development`, set to `production` for prod)

### 7. Embedding Provider (Optional)
- `EMBEDDING_PROVIDER` - Embedding provider (default: `huggingface`)
  - Options: `huggingface`, `openai`
- `OPENAI_API_KEY` - Only needed if using OpenAI embeddings
- `OPENAI_EMBEDDING_MODEL` - OpenAI embedding model (default: `text-embedding-3-small`)

### 8. Chunking Configuration (Optional)
- `CHUNK_SIZE` - Document chunk size (default: `1000`)
- `CHUNK_OVERLAP` - Chunk overlap (default: `200`)

## Summary for GitHub Actions

**Minimum Required Secrets:**
```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
HUGGINGFACE_API_KEY
DOCKERHUB_USERNAME
DOCKERHUB_TOKEN
```

**Recommended Additional Secrets:**
```
REDIS_URL (if using remote Redis)
CHROMA_URL (if using remote ChromaDB)
HUGGINGFACE_MODEL (if using a different model)
NODE_ENV=production (for production builds)
```

## How to Add Secrets in GitHub

1. Go to your repository on GitHub
2. Navigate to: **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret with the exact name listed above
5. Enter the corresponding value

## Notes

- **Translation Service**: Uses LibreTranslate (free, no API key required)
- **Session Storage**: Uses Redis (can be local or remote)
- **Vector Database**: Uses ChromaDB (can be local or remote)
- **Caching**: Uses Redis for semantic caching
