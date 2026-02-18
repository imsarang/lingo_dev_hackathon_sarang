import { chunkingService } from "../core/chunking";
import { embeddingService } from "../core/embedding";
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
            console.log(`\n=== Enhanced Ingestion ===`)

            // 1. Get PDF text
            const pdfData = await s3Service.getFileText(request.s3Bucket, request.s3Key)
            console.log(`✓ Extracted ${pdfData.totalPages} pages`)

            if(!pdfData.text || pdfData.text.trim().length === 0){
                throw new Error("No text found")
            }

            // 2. Parse metadata from filename
            const fileMetadata = parseFilename(request.s3Key)
            console.log(`✓ Metadata: ${fileMetadata.company}, ${fileMetadata.year}`)

            // 3. Detect sections
            const sections = chunkingService.detectSections(pdfData.text)
            console.log(`✓ Sections: ${sections.length}`)

            // 4. Create chunks
            const chunks = chunkingService.sectionAwareChunking(pdfData.text, sections)
            console.log(`✓ Chunks: ${chunks.length}`)

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

            // 6. Generate embeddings
            console.log(`Generating ${enrichedChunks.length} embeddings...`)
            const embeddings: number[][] = []
            for (let i = 0; i < enrichedChunks.length; i++) {
                if (i % 10 === 0) console.log(`  ${i}/${enrichedChunks.length}`)
                const embedding = await embeddingService.generateEmbedding(enrichedChunks[i].text)
                embeddings.push(embedding)
                await new Promise(r => setTimeout(r, 3000)) // LM Studio delay
            }

            // 7. Store
            await vectorDBClient.addDocuments(
                enrichedChunks.map(c => c.id),
                enrichedChunks.map(c => c.text),
                enrichedChunks.map(c => c.metadata),
                embeddings
            )

            console.log(`✓ Complete: ${enrichedChunks.length} chunks stored\n`)

            return {
                documentId,
                chunksProcessed: enrichedChunks.length,
                status: 'success'
            }

        } catch(error) {
            console.error("Ingestion error:", error)
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
            console.error("Query error:", error);
            throw error
        }
    }

    async queryWithRAG(question: string) {
        try {
            return await retrieverService.queryWithRAG(question)
        } catch (error) {
            console.error("RAG error:", error)
            throw error
        }
    }
}

export const ingestionService = new IngestionService()
