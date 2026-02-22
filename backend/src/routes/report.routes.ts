import { Router } from "express";
import { uploadMiddleware } from "../middleware/upload.middleware";
import { reportController } from "../controllers/report.controller";

const router = Router()

router.post('/upload', uploadMiddleware, (req, res) => reportController.uploadReport(req, res))
router.post('/analyze', (req, res) => reportController.analyzeReport(req, res))

export default router