# ChromaDB Data Access Guide

## Where is the ChromaDB Data Stored?

### Option 1: Docker with Persistent Volume (Recommended)

**Location:** `./chroma_data/` directory in your backend folder

**Setup:**
```bash
# Start ChromaDB with persistent storage
npm run chromadb:start

# Stop ChromaDB (data persists)
npm run chromadb:stop

# View logs
npm run chromadb:logs
```

The data will be stored in:
```
backend/
  └── chroma_data/          ← ChromaDB data stored here
      ├── chroma.sqlite3    ← SQLite database with metadata
      └── ...               ← Vector index files
```

### Option 2: Docker without Persistence

**Command:**
```bash
docker run -p 8000:8000 chromadb/chroma
```

⚠️ **Warning:** Data is lost when container stops!

### Option 3: ChromaDB Python Server (Local)

**Installation:**
```bash
pip install chromadb
chroma run --path ./chroma_data --port 8000
```

**Location:** Data stored in `./chroma_data/` directory

---

## How to Access ChromaDB Data

### Method 1: REST API Endpoints (Easiest)

I've added management endpoints to your server:

#### 1. Get Collection Statistics
```bash
curl http://localhost:3000/api/chromadb/stats
```

Response:
```json
{
  "name": "lingo-dev-collection",
  "count": 42,
  "metadata": {
    "hnsw:space": "cosine"
  }
}
```

#### 2. Get Document Count
```bash
curl http://localhost:3000/api/chromadb/documents/count
```

Response:
```json
{
  "count": 42
}
```

#### 3. List All Documents
```bash
# Get all documents (limited to 100 by default)
curl http://localhost:3000/api/chromadb/documents

# With custom limit
curl "http://localhost:3000/api/chromadb/documents?limit=50"

# Filter by metadata
curl "http://localhost:3000/api/chromadb/documents?filter=%7B%22documentId%22%3A%22doc-123%22%7D"
```

Response:
```json
{
  "count": 42,
  "ids": ["doc-123_chunk_0", "doc-123_chunk_1", ...],
  "documents": ["text content...", "more text...", ...],
  "metadatas": [
    {"documentId": "doc-123", "source": "file.pdf"},
    ...
  ]
}
```

#### 4. Get Specific Documents by IDs
```bash
curl -X POST http://localhost:3000/api/chromadb/documents/search \
  -H "Content-Type: application/json" \
  -d '{
    "ids": ["doc-123_chunk_0", "doc-123_chunk_1"]
  }'
```

#### 5. Delete Documents
```bash
# Delete by IDs
curl -X DELETE http://localhost:3000/api/chromadb/documents \
  -H "Content-Type: application/json" \
  -d '{
    "ids": ["doc-123_chunk_0", "doc-123_chunk_1"]
  }'

# Delete by metadata filter (e.g., delete entire document)
curl -X DELETE http://localhost:3000/api/chromadb/documents \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {"documentId": "doc-123"}
  }'
```

---

### Method 2: CLI Inspector Tool

I've created a command-line tool for easy inspection:

#### Show Statistics
```bash
npm run inspect stats
```

Output:
```
📊 ChromaDB Collection Stats

Collection Name: lingo-dev-collection
Total Documents: 42
Metadata: {
  "hnsw:space": "cosine"
}
```

#### Count Documents
```bash
npm run inspect count
```

#### List All Documents
```bash
npm run inspect list
```

Output:
```
📄 Listing all documents (limited to 20)

--- Document 1/42 ---
ID: doc-123_chunk_0
Metadata: {
  "documentId": "doc-123",
  "source": "report.pdf"
}
Text Preview: This is the beginning of the document...

--- Document 2/42 ---
...
```

#### Get Specific Document
```bash
npm run inspect get doc-123_chunk_0
```

#### Search by Metadata
```bash
npm run inspect search '{"documentId":"doc-123"}'
```

#### Delete Document
```bash
npm run inspect delete doc-123_chunk_0
```

---

### Method 3: ChromaDB Web UI (Optional)

Install ChromaDB admin UI:

```bash
# Using Docker
docker run -p 3001:3000 -e CHROMA_HOST=host.docker.internal -e CHROMA_PORT=8000 ghcr.io/chroma-core/chroma-admin:latest

# Then open: http://localhost:3001
```

---

### Method 4: Direct ChromaDB API

Access ChromaDB directly at `http://localhost:8000`:

```bash
# Get API version
curl http://localhost:8000/api/v1/version

# Get heartbeat
curl http://localhost:8000/api/v1/heartbeat

# List collections
curl http://localhost:8000/api/v1/collections

# Get collection details
curl http://localhost:8000/api/v1/collections/lingo-dev-collection
```

---

### Method 5: Python Script

If you have Python installed:

```python
import chromadb

# Connect to ChromaDB
client = chromadb.HttpClient(host='localhost', port=8000)

# Get collection
collection = client.get_collection(name="lingo-dev-collection")

# Get all documents
results = collection.get()
print(f"Total documents: {len(results['ids'])}")

# Get specific documents
results = collection.get(
    where={"documentId": "doc-123"}
)

# Query similar documents
results = collection.query(
    query_texts=["What is this about?"],
    n_results=5
)
```

---

## Quick Start Guide

### 1. Start ChromaDB
```bash
npm run chromadb:start
```

### 2. Start Your Server
```bash
npm run dev
```

### 3. Ingest a PDF
```bash
curl -X POST http://localhost:3000/api/ingest/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "s3Bucket": "my-bucket",
    "s3Key": "documents/report.pdf",
    "documentId": "report-2024",
    "metadata": {"title": "Annual Report 2024"}
  }'
```

### 4. Check the Data
```bash
# Quick stats
npm run inspect stats

# List documents
npm run inspect list

# Or via API
curl http://localhost:3000/api/chromadb/stats
```

### 5. Query the Data
```bash
curl -X POST http://localhost:3000/api/ingest/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the key findings?",
    "nResults": 5
  }'
```

---

## Data Persistence

### Backup ChromaDB Data
```bash
# Stop the server
npm run chromadb:stop

# Backup the data directory
tar -czf chromadb-backup-$(date +%Y%m%d).tar.gz chroma_data/

# Restart
npm run chromadb:start
```

### Restore ChromaDB Data
```bash
# Stop the server
npm run chromadb:stop

# Restore from backup
tar -xzf chromadb-backup-20240217.tar.gz

# Restart
npm run chromadb:start
```

### Clear All Data
```bash
# Stop ChromaDB
npm run chromadb:stop

# Remove data directory
rm -rf chroma_data/

# Restart (creates fresh database)
npm run chromadb:start
```

---

## Troubleshooting

### Can't Connect to ChromaDB
```bash
# Check if ChromaDB is running
curl http://localhost:8000/api/v1/heartbeat

# Check Docker container
docker ps | grep chromadb

# View logs
npm run chromadb:logs
```

### No Data Found
```bash
# Check collection exists
curl http://localhost:8000/api/v1/collections

# Check document count
npm run inspect count
```

### Port Already in Use
```bash
# Change port in docker-compose.chromadb.yml
ports:
  - "8001:8000"  # Use 8001 instead

# Update .env
CHROMA_URL=http://localhost:8001
```

---

## Summary

**Data Location:** `backend/chroma_data/` (when using Docker Compose)

**Access Methods:**
1. ✅ REST API: `http://localhost:3000/api/chromadb/*`
2. ✅ CLI Tool: `npm run inspect <command>`
3. ✅ Direct API: `http://localhost:8000/api/v1/*`
4. ⚡ Web UI: Optional Docker container
5. 🐍 Python Client: For advanced use

**Quick Commands:**
```bash
npm run chromadb:start    # Start ChromaDB
npm run dev               # Start your server
npm run inspect stats     # View data stats
npm run inspect list      # List documents
```
