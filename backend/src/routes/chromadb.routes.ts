// ChromaDB inspection and management routes
import { Router } from "express";
import { chromaDBController } from "../controllers/chromadb.controller";

const router = Router();

// Get collection statistics
router.get('/stats', (req, res) => chromaDBController.getStats(req, res));

// Get document count
router.get('/documents/count', (req, res) => chromaDBController.getCount(req, res));

// Get all documents (with optional filter)
router.get('/documents', (req, res) => chromaDBController.getDocuments(req, res));

// Get documents by IDs
router.post('/documents/search', (req, res) => chromaDBController.getDocumentsByIds(req, res));

// Delete documents
router.delete('/documents', (req, res) => chromaDBController.deleteDocuments(req, res));

export default router;
