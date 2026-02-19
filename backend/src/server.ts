// Load environment variables FIRST before any other imports
import './env'

// Main server entry point
import express from 'express'
import cors from 'cors'
import ingestRoutes from './routes/ingest.routes'
import chromadbRoutes from './routes/chromadb.routes'

const app = express()

// Enable CORS for frontend
app.use(cors({
    origin: ['http://localhost:3001', 'http://localhost:3000'], // Support both Next.js ports
    credentials: true
}))

app.use(express.json())
app.use('/api/ingest', ingestRoutes)
app.use('/api/chromadb', chromadbRoutes)

app.listen(3000)