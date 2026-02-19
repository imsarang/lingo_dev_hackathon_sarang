import { chunkingService } from "../core/chunking";
import { vectorDBClient } from "../db/client";
import { s3Service } from "./s3.service";
import { retrieverService } from "../core/retriever";
import { v4 as uuidv4 } from 'uuid'
import { parseFilename, extractKeywords, mapSectionToIntentTags, ChunkMetadata } from "../core/metadata"
import { sessionService } from "../services/session.service";
import { cacheService } from "./cache.service";

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

    async queryVectorDatabase(
        query: string,
        nResults: number = 5,
        filter?: Record<string, any>,
    ){
        try{
            const results = await vectorDBClient.query(query, nResults, filter)
            return results?.documents ?? []
        }
        catch(error){
            throw error
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
                await sessionService.addMessage(sessionId, 'user', question)
                await sessionService.addMessage(sessionId, 'assistant', cached.answer)
                return {answer: cached.answer, context: cached.context}
            }
            // cache miss

            let englishQuestion = question
            if (locale !== 'en') {
                console.log(`[INGESTION SERVICE] 🌐 Translating question from ${locale} to English...`)
                const { translateService } = require('./translate.service')
                try {
                    const startTime = Date.now()
                    englishQuestion = await translateService.translate(question, 'en')
                    const duration = Date.now() - startTime
                    console.log(`[INGESTION SERVICE] ✅ Translation completed in ${duration}ms`)
                    console.log('[INGESTION SERVICE] Translated question:', englishQuestion.substring(0, 100))
                } catch (error) {
                    console.log('[INGESTION SERVICE] ⚠️ Translation failed, using original question')
                    console.log('[INGESTION SERVICE] Translation error:', error)
                }
            } else {
                console.log('[INGESTION SERVICE] ℹ️ Locale is English, skipping translation')
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
                const { translateService } = require('./translate.service')
                try {
                    const startTime = Date.now()
                    translatedAnswer = await translateService.translate(result.answer, locale)
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
}

export const ingestionService = new IngestionService()
