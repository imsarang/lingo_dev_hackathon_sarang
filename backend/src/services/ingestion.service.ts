import { chunkingService } from "../core/chunking";
import { embeddingService } from "../core/embedding";
import { vectorDBClient } from "../db/client";
import { s3Service } from "./s3.service";
import { retrieverService } from "../core/retriever";
import { v4 as uuidv4 } from 'uuid'

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
        try{
            const text = await s3Service.getFileText(request.s3Bucket, request.s3Key)

            if(!text || text.trim().length === 0){
                throw new Error("No text found in the document")
            }

            const chunks = chunkingService.semnaticChunking(text, {
                documentId,
                source: request.s3Key,
                ...request.metadata
            })

            if(chunks.length == 0){
                throw new Error("No chunks found in the document")
            }

            const texts = chunks.map((chunk) => chunk.text)

            // COMMENTED OUT: Let ChromaDB generate embeddings automatically
            // // Process embeddings in batches for much faster performance
            // const provider = process.env.EMBEDDING_PROVIDER || 'huggingface'
            // const batchSize = provider === 'huggingface' ? 50 : 10 // HF can handle larger batches
            // const delayBetweenBatches = provider === 'huggingface' ? 500 : 2000
            
            // console.log(`Processing ${texts.length} embeddings in batches of ${batchSize} (${provider})...`)
            // const embeddings: number[][] = []
            
            // for (let i = 0; i < texts.length; i += batchSize) {
            //     const batch = texts.slice(i, Math.min(i + batchSize, texts.length))
            //     const batchNum = Math.floor(i / batchSize) + 1
            //     const totalBatches = Math.ceil(texts.length / batchSize)
                
            //     console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} texts)...`)
                
            //     const batchEmbeddings = await embeddingService.generateBatchEmbeddings(batch)
            //     embeddings.push(...batchEmbeddings)
                
            //     // Add delay between batches to avoid rate limiting
            //     if (i + batchSize < texts.length) {
            //         await new Promise(resolve => setTimeout(resolve, delayBetweenBatches))
            //     }
            // }
            // console.log('✓ All embeddings done')

            const ids = chunks.map((chunk, idx) => `${documentId}-chunk-${idx}`)
            const metadatas = chunks.map(chunk => chunk.metadata || {})

            console.log(`Passing ${texts.length} chunks to ChromaDB (embeddings will be auto-generated)...`)
            // Pass chunks without embeddings - ChromaDB will generate them
            await vectorDBClient.addDocuments(ids, texts, metadatas)
            
            return {
                documentId,
                chunksProcessed: chunks.length,
                status: 'success'
            }
        }
        catch(error){
            console.error("Error ingesting document from S3", error)
            return {
                documentId,
                chunksProcessed: 0,
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error'
            }
        }
    }

    // query the vector database for similar documents
    async queryVectorDatabase(
        query: string,
        nResults: number = 5,
        filter?: Record<string, any>,
    ){
        try{
            // COMMENTED OUT: Let ChromaDB generate query embeddings automatically
            // const embeddings = await embeddingService.generateEmbedding(query)
            // const results = await vectorDBClient.query(embeddings, nResults, filter)
            
            const results = await vectorDBClient.query(query, nResults, filter)
            return results?.documents ?? []
        }
        catch(error){
            console.error("Error querying vector database", error);
            throw error
        }
    }

    // LangGraph RAG query
    async queryWithRAG(question: string) {
        try {
            return await retrieverService.queryWithRAG(question)
        } catch (error) {
            console.error("RAG query error:", error)
            throw error
        }
    }
}

export const ingestionService = new IngestionService()