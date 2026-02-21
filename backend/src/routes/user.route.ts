import { Router, Request, Response } from 'express'
import { userController } from '../controllers/user.controller'
import { authMiddleware } from '../middleware/auth.middleware'

const router = Router()

router.post('/upsert', (req: Request, res: Response) => userController.upsert(req, res))

// Protected routes - require authentication
router.get('/sessions', 
    (req: Request, res: Response, next) => authMiddleware.verifyUser(req, res, next),
    (req: Request, res: Response) => userController.getChatSessions(req, res)
)

router.get('/sessions/:sessionUuid/messages',
    (req: Request, res: Response, next) => authMiddleware.verifyUser(req, res, next),
    (req: Request, res: Response) => userController.getSessionMessages(req, res)
)

router.delete('/sessions/:sessionUuid',
    (req: Request, res: Response, next) => authMiddleware.verifyUser(req, res, next),
    (req: Request, res: Response) => userController.deleteSession(req, res)
)

export default router