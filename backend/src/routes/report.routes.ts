import { Router } from "express";
import { uploadMiddleware } from "../middleware/upload.middleware";
import { reportController } from "../controllers/report.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router()

router.post('/upload', (req, res, next) => authMiddleware.verifyUser(req, res, next), uploadMiddleware, (req, res) => reportController.uploadReport(req, res))
router.post('/analyze', (req, res, next) => authMiddleware.verifyUser(req, res, next), (req, res) => reportController.analyzeReport(req, res))
router.post('/improve', (req, res, next) => authMiddleware.verifyUser(req, res, next), (req, res) => reportController.improveReport(req, res));

export default router