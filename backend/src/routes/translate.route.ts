import { Router, Request, Response } from "express"
import { translateController } from "../controllers/translate.controller"
import { authMiddleware } from "../middleware/auth.middleware"

const router = Router()

router.post('/', (req: Request, res: Response, next) => authMiddleware.authTranslate(req, res, next), (req: Request, res: Response) => translateController.getTranslation(req, res))
export default router