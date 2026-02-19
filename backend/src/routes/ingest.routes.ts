import { ingestController } from "../controllers/ingest.controller"
import { Router, Request, Response } from "express"

// Ingestion routes
const router = Router()

router.post('/ingest', (req: Request, res: Response) => ingestController.ingestDocumentFromS3(req, res))
router.post('/query', (req: Request, res: Response) => ingestController.queryDocuments(req, res))
router.post('/rag', (req: Request, res: Response) => ingestController.queryRAG(req, res))

// backend/src/routes/ingest.routes.ts

router.get('/cache/stats', (req: Request, res: Response) => ingestController.getCacheStats(req, res));
router.post('/cache/clear', (req: Request, res: Response) => ingestController.clearCache(req, res));

export default router