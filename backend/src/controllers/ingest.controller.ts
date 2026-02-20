import { IngestionRequest, ingestionService } from "../services/ingestion.service";
import { Request, Response } from "express";
import { sessionService } from "../services/session.service";
import { cacheService } from "../services/cache.service";

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

    async queryDocuments(
        req: Request,
        res: Response
    ){
        try{
            const {query, nResults, filter} = req.body

            if(!query){
                return res.status(400).json({
                    message: "Query is required"
                })
            }

            const queryResponse = await ingestionService.queryVectorDatabase(query, nResults, filter)
            res.status(200).json(queryResponse)
        }
        catch(error){
            res.status(500).json({
                message: "Error querying documents",
                error: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    }

    // LangGraph RAG endpoint with translation support
    async queryRAG(
        req: Request,
        res: Response
    ){
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('[CONTROLLER] RAG Query Started')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        
        try{
            const { question, locale } = req.body
            let { sessionId } = req.body

            console.log('[CONTROLLER] Request params:', {
                question: question?.substring(0, 100) + (question?.length > 100 ? '...' : ''),
                locale: locale || 'en',
                sessionId: sessionId || 'none (will create new)'
            })

            if(!question){
                console.log('[CONTROLLER] ❌ Validation failed: Question is required')
                return res.status(400).json({
                    message: "Question is required"
                })
            }

            // Generate sessionId if not provided (first conversation)
            if(!sessionId) {
                sessionId = sessionService.createSession()
                console.log(`[CONTROLLER] ✅ New session created: ${sessionId}`)
            } else {
                console.log(`[CONTROLLER] 🔄 Using existing session: ${sessionId}`)
            }

            console.log('[CONTROLLER] 📞 Calling ingestionService.queryWithRAG...')
            const startTime = Date.now()
            const result = await ingestionService.queryWithRAG(question, sessionId, locale || 'en')
            const duration = Date.now() - startTime

            console.log(`[CONTROLLER] ✅ RAG Query completed in ${duration}ms`)
            console.log('[CONTROLLER] Response summary:', {
                answerLength: result.answer.length,
                contextCount: result.context.length,
                sessionId
            })

            res.status(200).json({
                question,
                answer: result.answer,
                contextCount: result.context.length,
                context: result.context.slice(0, 3),
                sessionId: sessionId
            })
            
            console.log('[CONTROLLER] ✅ Response sent successfully')
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
        }
        catch(error){
            console.error('[CONTROLLER] ❌ Error in RAG query:')
            console.error('[CONTROLLER] Error details:', error)
            console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
            res.status(500).json({
                message: "Error in RAG query",
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

            // Stream the RAG process
            // Note: ingestionService.queryWithRAGStream already sends the 'complete' event
            // with the final answer, so we don't need to send another one here
            await ingestionService.queryWithRAGStream(
                question,
                sessionId,
                locale || 'en',
                sendEvent // Pass callback to send events
            )

            // Close the stream - ingestionService already sent the complete event
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