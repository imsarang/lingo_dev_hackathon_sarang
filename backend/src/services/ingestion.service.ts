import { chunkingService } from "../core/chunking";
import { vectorDBClient } from "../db/client";
import { s3Service } from "./s3.service";
import { retrieverService } from "../core/retriever";
import { v4 as uuidv4 } from 'uuid'
import { parseFilename, extractKeywords, mapSectionToIntentTags, ChunkMetadata } from "../core/metadata"

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

    async queryWithRAG(question: string, locale: string = 'en') {
        try {
            // Translate question to English if needed
            let englishQuestion = question
            if (locale !== 'en') {
                const { translateService } = require('./translate.service')
                try {
                    englishQuestion = await translateService.translate(question, 'en')
                } catch (error) {
                    // Use original question if translation fails
                }
            }
            
            const result = await retrieverService.queryWithRAG(englishQuestion)
            
            // Translate answer back to user's locale if needed
            if (locale !== 'en' && result.answer) {
                const { translateService } = require('./translate.service')
                try {
                    result.answer = await translateService.translate(result.answer, locale)
                } catch (error) {
                    // Return English answer if translation fails
                }
            }
            
            return result
        } catch (error) {
            throw error
        }
    }
}

export const ingestionService = new IngestionService()
