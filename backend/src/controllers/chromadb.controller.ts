// ChromaDB data inspection and management controller
import { Request, Response } from "express";
import { chromaUtils } from "../db/utils";

export class ChromaDBController {
    /**
     * GET /api/chromadb/stats
     * Get collection statistics
     */
    async getStats(req: Request, res: Response) {
        try {
            const info = await chromaUtils.getCollectionInfo();
            res.status(200).json(info);
        } catch (error) {
            console.error('Error getting stats:', error);
            res.status(500).json({
                error: 'Failed to get collection stats',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * GET /api/chromadb/documents
     * Get all documents (or filter by metadata)
     */
    async getDocuments(req: Request, res: Response) {
        try {
            const { filter, limit = 100 } = req.query;
            
            let result;
            if (filter && typeof filter === 'string') {
                const parsedFilter = JSON.parse(filter);
                result = await chromaUtils.getDocumentsByMetadata(parsedFilter);
            } else {
                result = await chromaUtils.getAllDocuments();
            }

            // Limit results for performance
            const limitNum = parseInt(limit as string);
            if (result.ids.length > limitNum) {
                result = {
                    ...result,
                    ids: result.ids.slice(0, limitNum),
                    documents: result.documents.slice(0, limitNum),
                    metadatas: result.metadatas.slice(0, limitNum),
                    truncated: true,
                    totalCount: result.count
                };
            }

            res.status(200).json(result);
        } catch (error) {
            console.error('Error getting documents:', error);
            res.status(500).json({
                error: 'Failed to get documents',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * POST /api/chromadb/documents/search
     * Search documents by IDs
     */
    async getDocumentsByIds(req: Request, res: Response) {
        try {
            const { ids } = req.body;

            if (!ids || !Array.isArray(ids)) {
                return res.status(400).json({
                    error: 'Invalid request',
                    message: 'ids must be an array'
                });
            }

            const result = await chromaUtils.getDocumentsByIds(ids);
            res.status(200).json(result);
        } catch (error) {
            console.error('Error getting documents by IDs:', error);
            res.status(500).json({
                error: 'Failed to get documents by IDs',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * DELETE /api/chromadb/documents
     * Delete documents by IDs or metadata filter
     */
    async deleteDocuments(req: Request, res: Response) {
        try {
            const { ids, filter } = req.body;

            if (ids && Array.isArray(ids)) {
                const result = await chromaUtils.deleteDocumentsByIds(ids);
                return res.status(200).json(result);
            } else if (filter && typeof filter === 'object') {
                const result = await chromaUtils.deleteDocumentsByMetadata(filter);
                return res.status(200).json(result);
            } else {
                return res.status(400).json({
                    error: 'Invalid request',
                    message: 'Must provide either ids array or filter object'
                });
            }
        } catch (error) {
            console.error('Error deleting documents:', error);
            res.status(500).json({
                error: 'Failed to delete documents',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * GET /api/chromadb/documents/count
     * Get document count
     */
    async getCount(req: Request, res: Response) {
        try {
            const count = await chromaUtils.getDocumentCount();
            res.status(200).json({ count });
        } catch (error) {
            console.error('Error getting count:', error);
            res.status(500).json({
                error: 'Failed to get document count',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    async getCompanies(req: Request, res: Response){
        try{
            const companies = await chromaUtils.getCompanies()
            res.status(200).json({companies})
        }
        catch(err){
            res.status(500).json({
                error: err
            })
        }
    }
}

export const chromaDBController = new ChromaDBController();
