# PDF Ingestion Pipeline - Setup Guide

## Overview
This backend service ingests PDFs from AWS S3, processes them, and stores vector embeddings in ChromaDB for semantic search.

## Architecture Flow
```
API Request → Controller → Service → Core Components
    ↓
1. Download PDF from S3 (s3.service.ts)
2. Extract text from PDF (pdf-parse)
3. Chunk text (chunking.ts)
4. Generate embeddings (embedding.ts)
5. Store in ChromaDB (client.ts)
```

## Fixed Issues

### 1. TypeScript Type Errors
- ✅ Added missing `Request` and `Response` imports from express in controller
- ✅ Installed `@types/express`, `@types/uuid`, `@types/pdf-parse`
- ✅ Fixed pdf-parse import using require() for CommonJS compatibility

### 2. Runtime Initialization
- ✅ Added automatic ChromaDB collection initialization before operations
- ✅ Ensured collection is created before adding/querying documents

### 3. Configuration
- ✅ Created centralized config file (`config/index.ts`)
- ✅ Environment variables properly typed and with defaults

## API Endpoints

### 1. Ingest PDF from S3
```bash
POST /api/ingest/ingest
Content-Type: application/json

{
  "s3Bucket": "your-bucket-name",
  "s3Key": "path/to/document.pdf",
  "documentId": "optional-custom-id",
  "metadata": {
    "title": "Document Title",
    "author": "Author Name"
  }
}
```

Response:
```json
{
  "documentId": "uuid-or-custom-id",
  "chunksProcessed": 42,
  "status": "success"
}
```

### 2. Query Documents
```bash
POST /api/ingest/query
Content-Type: application/json

{
  "query": "What is the main topic?",
  "nResults": 5,
  "filter": {
    "documentId": "specific-doc-id"
  }
}
```

## Environment Variables

Create a `.env` file in the backend directory:

```env
# Server
PORT=3000

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# OpenAI
OPENAI_API_KEY=your_openai_key
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# ChromaDB
CHROMA_URL=http://localhost:8000
CHROMA_COLLECTION_NAME=lingo-dev-collection

# Chunking
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
```

## Installation

```bash
cd backend
npm install
```

## Running the Service

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

## Dependencies Installed

- `@aws-sdk/client-s3` - AWS S3 client
- `chromadb` - Vector database client
- `openai` - OpenAI API client for embeddings
- `pdf-parse` - PDF text extraction
- `uuid` - Unique ID generation
- `express` - Web framework
- `@types/express` - TypeScript types for Express
- `@types/uuid` - TypeScript types for UUID
- `@types/pdf-parse` - TypeScript types for pdf-parse

## Testing

### Start ChromaDB (Docker)
```bash
docker run -p 8000:8000 chromadb/chroma
```

### Test the API
```bash
# Ingest a PDF
curl -X POST http://localhost:3000/api/ingest/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "s3Bucket": "my-bucket",
    "s3Key": "documents/sample.pdf",
    "metadata": {"title": "Sample Document"}
  }'

# Query documents
curl -X POST http://localhost:3000/api/ingest/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is this document about?",
    "nResults": 5
  }'
```

## Build Status
✅ All TypeScript compilation errors fixed
✅ All linter errors resolved
✅ Build successful
✅ Ready for deployment
