// Load environment variables FIRST before any other imports
import './env'

// Main server entry point
import express from 'express'
import cors from 'cors'
import ingestRoutes from './routes/ingest.routes'
import chromadbRoutes from './routes/chromadb.routes'
import translateRoutes from './routes/translate.route'
import userRoutes from './routes/user.route'
import reportRoutes from './routes/report.routes';
import { sqsConsumerService } from './services/sqs-consumer.service';

const app = express()

// Enable CORS for frontend
const allowedOrigins = [
    'http://localhost:3001',
    'http://localhost:3000',
    process.env.CORS_ORIGIN || process.env.FRONTEND_URL
].filter(Boolean) // Remove undefined values

app.use(cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : '*', // Fallback to * if no origins specified
    credentials: true
}))

app.use(express.json())
app.use('/api/ingest', ingestRoutes)
app.use('/api/chromadb', chromadbRoutes)
app.use('/api/translate', translateRoutes)
app.use('/api/users', userRoutes)
app.use('/api/reports', reportRoutes)

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`)
    
    // Start SQS consumer if enabled and queue URL is configured
    // Note: The consumer will poll SQS for messages containing S3 file references.
    // When messages arrive, it will automatically ingest those files into the vector DB.
    // It does NOT ingest all existing docs on startup - only processes new messages from SQS.
    const enableSQSConsumer = process.env.ENABLE_SQS_CONSUMER === 'true';
    const sqsQueueUrl = process.env.SQS_QUEUE_URL;
    
    if (enableSQSConsumer && sqsQueueUrl) {
        console.log('📬 Starting SQS consumer...');
        console.log('📝 Consumer will process SQS messages and ingest files from S3 into vector DB');
        sqsConsumerService.start().catch((error) => {
            console.error('❌ Failed to start SQS consumer:', error);
            // Don't crash the server if consumer fails to start
        });
    } else if (enableSQSConsumer && !sqsQueueUrl) {
        console.warn('⚠️  ENABLE_SQS_CONSUMER is true but SQS_QUEUE_URL is not set. SQS consumer not started.');
    }
})