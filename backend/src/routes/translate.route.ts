import { Router, Request, Response } from "express"
import { translateController } from "../controllers/translate.controller"

const router = Router()

router.post('/', (req: Request, res: Response) => translateController.getTranslation(req, res))
export default router