import { Request, Response } from 'express'
import { userService } from '../services/user.service'

class UserController {
    async upsert(req: Request, res: Response) {
        try {
            const { googleId, email, name, image } = req.body

            if (!googleId || !email) {
                return res.status(400).json({
                    success: false,
                    message: 'googleId and email are required'
                })
            }

            const result = await userService.upsert({ googleId, name, email, image })
            return res.status(200).json({
                success: true,
                message: 'User upserted successfully',
                user: {
                    id: result.id.toString(),
                    email: result.email,
                    name: result.name,
                    role: result.role
                }
            })
        }
        catch (err) {
            console.error('Error in upsertUser controller:', err)
            return res.status(500).json({
                success: false,
                message: 'Error upserting user',
                error: err instanceof Error ? err.message : 'Unknown error'
            })
        }
    }

    async getChatSessions(req: Request, res: Response){
        try {
            const user = (req as any).user
            if (!user || !user.googleId) {
                return res.status(401).json({
                    success: false,
                    message: 'Unauthorized'
                })
            }

            const dbUser = await userService.findByGoogleId(user.googleId)
            if (!dbUser) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                })
            }

            const { dbService } = await import('../services/db.service')
            const sessions = await dbService.getUserChatSessions(dbUser.id)

            return res.status(200).json({
                success: true,
                sessions: sessions.map(s => ({
                    id: s.id.toString(),
                    sessionUuid: s.sessionUuid,
                    createdAt: s.createdAt,
                    messageCount: s._count.messages
                }))
            })
        }
        catch (err) {
            console.error('Error fetching chat sessions:', err)
            return res.status(500).json({
                success: false,
                message: 'Error fetching chat sessions',
                error: err instanceof Error ? err.message : 'Unknown error'
            })
        }
    }

    async getSessionMessages(req: Request, res: Response){
        try {
            const user = (req as any).user
            if (!user || !user.googleId) {
                return res.status(401).json({
                    success: false,
                    message: 'Unauthorized'
                })
            }

            const sessionUuid = Array.isArray(req.params.sessionUuid) 
                ? req.params.sessionUuid[0] 
                : req.params.sessionUuid
            
            if (!sessionUuid) {
                return res.status(400).json({
                    success: false,
                    message: 'sessionUuid is required'
                })
            }

            const dbUser = await userService.findByGoogleId(user.googleId)
            if (!dbUser) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                })
            }

            const { dbService } = await import('../services/db.service')
            const session = await dbService.getSessionByUuid(sessionUuid)

            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: 'Session not found'
                })
            }

            // Verify session belongs to user
            if (session.userId !== dbUser.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                })
            }

            return res.status(200).json({
                success: true,
                session: {
                    id: session.id.toString(),
                    sessionUuid: session.sessionUuid,
                    createdAt: session.createdAt
                },
                messages: session.messages.map(m => ({
                    id: m.id.toString(),
                    role: m.role,
                    content: m.content,
                    locale: m.locale,
                    englishContent: m.englishContent,
                    createdAt: m.createdAt
                }))
            })
        }
        catch (err) {
            console.error('Error fetching session messages:', err)
            return res.status(500).json({
                success: false,
                message: 'Error fetching messages',
                error: err instanceof Error ? err.message : 'Unknown error'
            })
        }
    }

    async deleteSession(req: Request, res: Response){
        try {
            const user = (req as any).user
            if (!user || !user.googleId) {
                return res.status(401).json({
                    success: false,
                    message: 'Unauthorized'
                })
            }

            const sessionUuid = Array.isArray(req.params.sessionUuid) 
                ? req.params.sessionUuid[0] 
                : req.params.sessionUuid
            
            if (!sessionUuid) {
                return res.status(400).json({
                    success: false,
                    message: 'sessionUuid is required'
                })
            }

            const dbUser = await userService.findByGoogleId(user.googleId)
            if (!dbUser) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                })
            }

            const { dbService } = await import('../services/db.service')
            const session = await dbService.getSessionByUuid(sessionUuid)

            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: 'Session not found'
                })
            }

            // Verify session belongs to user
            if (session.userId !== dbUser.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                })
            }

            // Delete the session and all its messages
            await dbService.deleteChatSession(session.id)

            return res.status(200).json({
                success: true,
                message: 'Session deleted successfully'
            })
        }
        catch (err) {
            console.error('Error deleting session:', err)
            return res.status(500).json({
                success: false,
                message: 'Error deleting session',
                error: err instanceof Error ? err.message : 'Unknown error'
            })
        }
    }
}

export const userController = new UserController()