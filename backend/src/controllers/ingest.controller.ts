import { IngestionRequest, ingestionService } from "../services/ingestion.service";
import { Request, Response } from "express";
import { sessionService } from "../services/session.service";
import { cacheService } from "../services/cache.service";
import { dbService } from "../services/db.service";

// Ingestion controller
export class IngestController {
    async ingestDocumentFromS3(
        req: Request,
        res: Response
    ){
        try{
            const { s3Bucket, s3Key, documentId, metadata } = req.body

            if(!s3Bucket || !s3Key){
                return res.status(400).json({
                    message: "S3 bucket and S3 key are required"
                })
            }

            const ingestionRequest: IngestionRequest = {
                s3Bucket,
                s3Key,
                documentId,
                metadata
            }
            const ingestionResponse = await ingestionService.ingestDocumentFromS3(ingestionRequest)
            res.status(200).json(ingestionResponse)
        }
        catch(error){
            res.status(500).json({
                message: "Error ingesting document from S3",
                error: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    }

    // cache routes
    async getCacheStats(req: Request, res: Response) {
        try {
            const stats = await cacheService.getCacheStats();
            res.status(200).json(stats);
        } catch (error) {
            res.status(500).json({
                message: "Error getting cache stats",
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    
    async clearCache(req: Request, res: Response) {
        try {
            const { locale } = req.body;
            await cacheService.clearCache(locale);
            res.status(200).json({ message: 'Cache cleared successfully' });
        } catch (error) {
            res.status(500).json({
                message: "Error clearing cache",
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    // rag with SSE enabled
    async queryRAGStream(req: Request, res: Response){
        // Set SSE headers - CRITICAL for streaming
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')
        res.setHeader('X-Accel-Buffering', 'no') // Disable nginx buffering
        
        // Enable CORS for SSE
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Credentials', 'true')

        // Track if error was already sent to prevent duplicates
        let errorSent = false

        // Helper function to send SSE events
        const sendEvent = (type: string, data: any) => {
            // Prevent sending multiple errors
            if (type === 'error' && errorSent) {
                return
            }
            if (type === 'error') {
                errorSent = true
            }
            const event = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`
            res.write(event)
        }

        try{
            const { question, locale } = req.body
            let { sessionId } = req.body
            const currentLocale = locale || 'en'

            if(!question){
                sendEvent('error', { message: 'Question is required' })
                res.end()
                return
            }

            // Generate sessionId if not provided (first conversation)
            if(!sessionId) {
                sessionId = sessionService.createSession()
                sendEvent('session', { sessionId })
            }

            // Save to DB if user is logged in
            let dbSessionId: bigint | null = null
            if (req.user && req.user.googleId && req.user.email) {
                try {
                    const user = await dbService.getOrCreateUser(
                        req.user.googleId,
                        req.user.email,
                        req.user.name || undefined
                    )
                    const chatSession = await dbService.getOrCreateChatSession(sessionId, user.id)
                    dbSessionId = chatSession.id
                    
                    // Save user message
                    await dbService.createUserMessage(
                        dbSessionId,
                        question,
                        currentLocale,
                        currentLocale === 'en' ? question : undefined
                    )
                } catch (dbError) {
                    console.error('[INGEST CONTROLLER] DB error (continuing):', dbError)
                }
            }

            // Stream the RAG process
            let finalAnswer: string | null = null
            await ingestionService.queryWithRAGStream(
                question,
                sessionId,
                currentLocale,
                sendEvent,
                (answer: string) => { finalAnswer = answer }
            )

            // Save assistant message to DB if user is logged in
            if (dbSessionId && finalAnswer) {
                try {
                    await dbService.createAssistantMessage(
                        dbSessionId,
                        finalAnswer,
                        currentLocale,
                        currentLocale === 'en' ? finalAnswer : undefined
                    )
                } catch (dbError) {
                    console.error('[INGEST CONTROLLER] DB error saving assistant message:', dbError)
                }
            }

            // Close the stream
            res.end()
            
        } catch(error){
            // Only send error if not already sent
            if (!errorSent) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error'
                // Make error message user-friendly
                let userFriendlyMessage = 'An error occurred while processing your request.'
                
                if (errorMessage.includes('GPU') || errorMessage.includes('ErrorDeviceLost')) {
                    userFriendlyMessage = 'The AI service is temporarily unavailable due to a GPU error. Please try again in a moment or restart the model server.'
                } else if (errorMessage.includes('timeout')) {
                    userFriendlyMessage = 'The request took too long to process. Please try again with a shorter question.'
                } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
                    userFriendlyMessage = 'Connection error. Please check your internet connection and try again.'
                }
                
                sendEvent('error', { message: userFriendlyMessage })
            }
            res.end()
        }
    }
}

export const ingestController = new IngestController()