import { Router, Request, Response } from 'express'
import { questionController } from '../controllers/question.controller'

const router = Router()

router.post('/ask', (req: Request, res: Response) => questionController.ask(req, res))

export default router
