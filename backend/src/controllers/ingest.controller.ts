import { IngestionRequest, ingestionService } from "../services/ingestion.service";
import { Request, Response } from "express";

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
        try{
            const { question, locale } = req.body

            if(!question){
                return res.status(400).json({
                    message: "Question is required"
                })
            }


            const result = await ingestionService.queryWithRAG(question, locale || 'en')


            res.status(200).json({
                question,
                answer: result.answer,
                contextCount: result.context.length,
                context: result.context.slice(0, 3)
            })
        }
        catch(error){
            console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
            res.status(500).json({
                message: "Error in RAG query",
                error: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    }
}

export const ingestController = new IngestController()