import { chunkingService } from "../core/chunking";
import { vectorDBClient } from "../db/client";
import { s3Service } from "./s3.service";
import { retrieverService } from "../core/retriever";
import { v4 as uuidv4 } from 'uuid'
import { parseFilename, extractKeywords, mapSectionToIntentTags, ChunkMetadata } from "../core/metadata"
import { sessionService } from "../services/session.service";
import { cacheService } from "./cache.service";
import { translateLingoService } from "./translate-lingo.service";

// Ingestion service
export interface IngestionRequest {
    s3Bucket: string,
    s3Key: string,
    documentId?:string,
    metadata?: Record<string, any>,
}

export interface IngestionResponse {
    documentId: string,
    chunksProcessed: number,
    status: 'success' | 'failed',
    error?: string,
}

export class IngestionService {

    async ingestDocumentFromS3(
        request: IngestionRequest,
    ): Promise<IngestionResponse> {

        const documentId = request.documentId || uuidv4()
        
        try {
            // 1. Get PDF text
            const pdfData = await s3Service.getFileText(request.s3Bucket, request.s3Key)

            if(!pdfData.text || pdfData.text.trim().length === 0){
                throw new Error("No text found")
            }

            // 2. Parse metadata from filename
            const fileMetadata = parseFilename(request.s3Key)

            // 3. Detect sections
            const sections = chunkingService.detectSections(pdfData.text)

            // 4. Create chunks
            const chunks = chunkingService.sectionAwareChunking(pdfData.text, sections)

            if(chunks.length === 0) throw new Error("No chunks found")

            // 5. Add metadata to chunks
            const enrichedChunks = chunks.map((chunk, i) => {
                const keywords = extractKeywords(chunk.text)
                const intentTags = mapSectionToIntentTags(chunk.sectionType)
                
                const metadata: ChunkMetadata = {
                    documentId,
                    company: fileMetadata.company,
                    year: fileMetadata.year,
                    documentType: fileMetadata.documentType,
                    sectionType: chunk.sectionType,
                    intentTags,
                    keywords,
                    chunkIndex: i,
                    s3Bucket: request.s3Bucket,
                    s3Key: request.s3Key
                }
                
                return {
                    id: `${documentId}_${i}`,
                    text: chunk.text,
                    metadata
                }
            })

            // 6. Store
            await vectorDBClient.addDocuments(
                enrichedChunks.map(c => c.id),
                enrichedChunks.map(c => c.text),
                enrichedChunks.map(c => c.metadata),
                undefined
            )

            return {
                documentId,
                chunksProcessed: enrichedChunks.length,
                status: 'success'
            }

        } catch(error) {
            return {
                documentId,
                chunksProcessed: 0,
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error'
            }
        }
    }

    async queryWithRAG(question: string, sessionId: string, locale: string = 'en') {
        console.log('\n[INGESTION SERVICE] Starting queryWithRAG')
        console.log('[INGESTION SERVICE] Input params:', {
            question: question.substring(0, 100) + (question.length > 100 ? '...' : ''),
            sessionId,
            locale
        })
        
        try {
            // Translate question to English if needed
            // check cache

            const cached = await cacheService.findSimilarCached(question, locale)

            if(cached){
                // Translate question and answer to English before saving to DB
                let englishQuestion = question
                let englishAnswer = cached.answer
                
                try {
                    // Use provided locale or detect if needed
                    if (locale !== 'en') {
                        englishQuestion = await translateLingoService.translate(question, 'en', locale)
                    }
                    // Answer is already in the target locale, translate to English
                    if (locale !== 'en') {
                        englishAnswer = await translateLingoService.translate(cached.answer, 'en', locale)
                    }
                } catch (error) {
                    console.error('[INGESTION SERVICE] Error translating cached response to English:', error)
                }
                
                await sessionService.addMessage(sessionId, 'user', englishQuestion)
                await sessionService.addMessage(sessionId, 'assistant', englishAnswer)
                return {answer: cached.answer, context: cached.context}
            }
            // cache miss

            // Translate question to English before saving to DB (use provided locale, skip detection)
            let englishQuestion = question
            if (locale !== 'en') {
                try {
                    console.log(`[INGESTION SERVICE] 🌐 Translating question from ${locale} to English...`)
                    const startTime = Date.now()
                    englishQuestion = await translateLingoService.translate(question, 'en', locale)
                    const duration = Date.now() - startTime
                    console.log(`[INGESTION SERVICE] ✅ Translation completed in ${duration}ms`)
                    console.log('[INGESTION SERVICE] Translated question:', englishQuestion.substring(0, 100))
                } catch (error) {
                    console.log('[INGESTION SERVICE] ⚠️ Translation failed, using original question')
                    console.log('[INGESTION SERVICE] Translation error:', error)
                }
            } else {
                console.log('[INGESTION SERVICE] ℹ️ Question is already in English')
            }
            
            // Get conversation history
            console.log('[INGESTION SERVICE] 📚 Fetching conversation history...')
            const history = await sessionService.getHistory(sessionId)
            console.log(`[INGESTION SERVICE] ✅ Retrieved ${history.length} messages from history`)
            
            const conversationHistory = sessionService.formatHistoryForContext(history)
            console.log('[INGESTION SERVICE] Formatted history length:', conversationHistory.length, 'chars')
            
            // Store user question
            console.log('[INGESTION SERVICE] 💾 Storing user question in session...')
            await sessionService.addMessage(sessionId, 'user', englishQuestion)
            console.log('[INGESTION SERVICE] ✅ User message stored')

            // Get RAG answer
            console.log('[INGESTION SERVICE] 🔍 Calling retrieverService.queryWithRAG...')
            const ragStartTime = Date.now()
            const result = await retrieverService.queryWithRAG(englishQuestion, conversationHistory)
            const ragDuration = Date.now() - ragStartTime
            console.log(`[INGESTION SERVICE] ✅ RAG completed in ${ragDuration}ms`)
            console.log('[INGESTION SERVICE] RAG result:', {
                answerLength: result.answer.length,
                contextCount: result.context.length
            })
            
            // Store assistant response (in English)
            console.log('[INGESTION SERVICE] 💾 Storing assistant response in session...')
            await sessionService.addMessage(sessionId, 'assistant', result.answer)
            console.log('[INGESTION SERVICE] ✅ Assistant message stored')
            
            // Translate answer back to user's locale if needed
            let translatedAnswer = result.answer
            if (locale !== 'en' && result.answer) {
                console.log(`[INGESTION SERVICE] 🌐 Translating answer back to ${locale}...`)
                try {
                    const startTime = Date.now()
                    translatedAnswer = await translateLingoService.translate(result.answer, locale, 'en')
                    const duration = Date.now() - startTime
                    console.log(`[INGESTION SERVICE] ✅ Answer translation completed in ${duration}ms`)
                } catch (error) {
                    console.log('[INGESTION SERVICE] ⚠️ Answer translation failed, returning English')
                    console.log('[INGESTION SERVICE] Translation error:', error)
                }
            } else {
                console.log('[INGESTION SERVICE] ℹ️ Skipping answer translation (locale is English)')
            }
            
            console.log('[INGESTION SERVICE] ✅ queryWithRAG completed successfully\n')

            // cache the response
            await cacheService.cacheResponse(
                question,
                translatedAnswer,
                result.context,
                locale
            )
            return { ...result, answer: translatedAnswer }
        } catch (error) {
            console.error('[INGESTION SERVICE] ❌ Error in queryWithRAG:', error)
            throw error
        }
    }

    // RAG with SSE streaming
    async queryWithRAGStream(
        question: string,
        sessionId: string,
        locale: string,
        sendEvent: (type: string, data: any) => void,
        onComplete?: (answer: string) => void
    ) {
        try {
            // Stage 1: Check cache
            sendEvent('status', { 
                status: 'checking_cache',
                message: 'Checking cache for similar questions...'
            })

            const cached = await cacheService.findSimilarCached(question, locale)
            
            if (cached) {
                sendEvent('status', { 
                    status: 'cache_hit',
                    message: 'Found cached answer!'
                })
                
                // Translate question and answer to English before saving to DB
                let englishQuestion = question
                let englishAnswer = cached.answer
                
                try {
                    // Use provided locale for translation (skip detection for speed)
                    if (locale !== 'en') {
                        englishQuestion = await translateLingoService.translate(question, 'en', locale)
                        englishAnswer = await translateLingoService.translate(cached.answer, 'en', locale)
                    }
                } catch (error) {
                    console.error('[INGESTION SERVICE] Error translating cached response to English:', error)
                }
                
                await sessionService.addMessage(sessionId, 'user', englishQuestion)
                await sessionService.addMessage(sessionId, 'assistant', englishAnswer)
                
                // Stream cached answer word by word for smooth UX
                const words = cached.answer.split(' ')
                let accumulated = ''
                for (const word of words) {
                    accumulated += (accumulated ? ' ' : '') + word
                    sendEvent('token', { token: word, accumulated })
                    // Small delay for smooth streaming effect
                    await new Promise(resolve => setTimeout(resolve, 20))
                }
                
                sendEvent('complete', {
                    answer: cached.answer,
                    englishAnswer: englishAnswer,
                    context: cached.context,
                    contextCount: cached.context.length,
                    sessionId,
                    cached: true
                })
                if (onComplete) onComplete(cached.answer)
                return
            }

            sendEvent('status', { 
                status: 'cache_miss',
                message: 'Cache miss, processing query...'
            })

            // Stage 2: Translate question to English before saving to DB
            let englishQuestion = question
            if (locale !== 'en') {
                try {
                sendEvent('status', { 
                    status: 'translating',
                    message: `Translating question from ${locale} to English...`
                })
                    englishQuestion = await translateLingoService.translate(question, 'en', locale)
                } catch (error) {
                    console.error('[INGESTION SERVICE] Error translating question to English:', error)
                    // Continue with original
                }
            }

            // Stage 3: Get history
            sendEvent('status', { 
                status: 'loading_history',
                message: 'Loading conversation history...'
            })
            
            const history = await sessionService.getHistory(sessionId)
            const conversationHistory = sessionService.formatHistoryForContext(history)
            
            await sessionService.addMessage(sessionId, 'user', englishQuestion)

            // Stage 4: Retrieve documents
            sendEvent('status', { 
                status: 'retrieving',
                message: 'Retrieving relevant documents...'
            })

            // Get RAG answer with streaming
            sendEvent('status', { 
                status: 'generating',
                message: 'Generating answer...'
            })

            const result = await retrieverService.queryWithRAGStream(
                englishQuestion,
                conversationHistory,
                (token: string, accumulated: string) => {
                    // Send each token as it arrives
                    sendEvent('token', { token, accumulated })
                }
            )

            // Check if result contains an error message
            if (result.answer && (
                result.answer.toLowerCase().includes('error') || 
                result.answer.toLowerCase().includes('failed') ||
                result.answer.toLowerCase().includes('unavailable') ||
                result.answer.toLowerCase().includes('streaming failed') ||
                result.answer.toLowerCase().includes('gpu error')
            )) {
                // If answer looks like an error, send it as error event and return
                sendEvent('error', { message: result.answer })
                return
            }

            // Store assistant response
            await sessionService.addMessage(sessionId, 'assistant', result.answer)

            // Stage 5: Translate answer
            let translatedAnswer = result.answer
            if (locale !== 'en' && result.answer) {
                sendEvent('status', { 
                    status: 'translating',
                    message: `Translating answer to ${locale}...`
                })
                
                try {
                    translatedAnswer = await translateLingoService.translate(result.answer, locale, 'en')
                } catch (error) {
                    // Use English answer
                }
            }

            // Cache the response
            await cacheService.cacheResponse(
                question,
                translatedAnswer,
                result.context,
                locale
            )

            // Send completion
            sendEvent('complete', {
                answer: translatedAnswer,
                englishAnswer: result.answer,
                context: result.context,
                contextCount: result.context.length,
                sessionId,
                cached: false
            })

            if (onComplete) onComplete(translatedAnswer)

        } catch (error) {
            // Only send error if not already sent (prevent duplicates)
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            
            // Make error message user-friendly
            let userFriendlyMessage = 'An error occurred while processing your request. Please try again.'
            
            if (errorMessage.includes('GPU') || errorMessage.includes('ErrorDeviceLost')) {
                userFriendlyMessage = 'The AI service is temporarily unavailable due to a GPU error. Please try again in a moment or restart the model server.'
            } else if (errorMessage.includes('timeout')) {
                userFriendlyMessage = 'The request took too long to process. Please try again with a shorter question.'
            } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
                userFriendlyMessage = 'Connection error. Please check your internet connection and try again.'
            }
            
            sendEvent('error', { message: userFriendlyMessage })
            throw error
        }
    }
}

export const ingestionService = new IngestionService()
