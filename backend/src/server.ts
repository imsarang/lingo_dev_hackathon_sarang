// Load environment variables FIRST before any other imports
import './env'

// Main server entry point
import express from 'express'
import ingestRoutes from './routes/ingest.routes'
import chromadbRoutes from './routes/chromadb.routes'

const app = express()

app.use(express.json())
app.use('/api/ingest', ingestRoutes)
app.use('/api/chromadb', chromadbRoutes)

app.listen(3000, () => {
    console.log('Server is running on port 3000');
    console.log('\nAPI routes:');
    console.log('  Ingestion:');
    console.log('    - POST /api/ingest/ingest');
    console.log('    - POST /api/ingest/query');
    console.log('\n  ChromaDB Management:');
    console.log('    - GET  /api/chromadb/stats');
    console.log('    - GET  /api/chromadb/documents/count');
    console.log('    - GET  /api/chromadb/documents');
    console.log('    - POST /api/chromadb/documents/search');
    console.log('    - DELETE /api/chromadb/documents');
})