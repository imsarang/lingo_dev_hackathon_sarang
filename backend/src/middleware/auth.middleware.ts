import { Request, Response, NextFunction } from 'express'
import { OAuth2Client } from "google-auth-library"
import { createClient, RedisClientType } from 'redis'

// Extend Express Request to include user
declare global {
    namespace Express {
        interface Request {
            user?: {
                googleId?: string
                email?: string
                name?: string
            } | null
        }
    }
}

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

class AuthMiddleware {

    private redisClient: RedisClientType | null = null
    private isConnected: boolean = false

    constructor(){this._initRedis()}

    private async _initRedis(){
        try{
            if(!this.redisClient){
                this.redisClient = createClient({
                    url: process.env.REDIS_URL || 'redis://localhost:6379'
                }) as RedisClientType

                this.redisClient.on('error', (err: Error) => {
                    console.error('[AUTH MIDDLEWARE] Redis error:', err)
                    this.isConnected = false
                })

                this.redisClient.on('connect', () => {
                    console.log('[AUTH MIDDLEWARE] Connected to Redis')
                    this.isConnected = true
                })

                await this.redisClient.connect()

                console.log('[AUTH MIDDLEWARE] Redis connected successfully')
            }
        }
        catch(err){
            console.error('[AUTH MIDDLEWARE] Failed to connect to Redis:', err)
            // Don't throw - allow middleware to work without Redis
        }
    }

    async authTranslate(req: Request, res: Response, next: NextFunction){
        try{
            const authHeader = req.headers.authorization
            if(!authHeader) return res.status(401).json({
                error: "Unauthorized"
            })

            const token = authHeader.split(' ')[1]
            if (!token) {
                return res.status(401).json({
                    error: "Auth failure - Invalid token format"
                })
            }

            const ticket = await client.verifyIdToken({
                idToken: token,
                audience: process.env.GOOGLE_CLIENT_ID
            })

            const payload = ticket.getPayload()
            req.user = {
                googleId: payload?.sub,
                email: payload?.email,
                name: payload?.name
            }

            next()

        }
        catch(err){
            console.error('Auth middleware error:', err)
            return res.status(401).json({ error: 'Invalid token' })
        }
    }

    async verifyUser(req: Request, res: Response, next: NextFunction) {
        try {
            const authHeader = req.headers.authorization
            const userStatus = req.headers['x-user-role']
            
            // Allow guest users without auth header
            if (!authHeader && userStatus === 'guest') {
                req.user = null
                return next()
            }

            // Require auth header for non-guest users
            if (!authHeader) {
                return res.status(401).json({
                    error: "Auth failure - Authorization header required"
                })
            }

            const token = authHeader.split(' ')[1]
            if (!token) {
                return res.status(401).json({
                    error: "Auth failure - Invalid token format"
                })
            }

            const ticket = await client.verifyIdToken({
                idToken: token,
                audience: process.env.GOOGLE_CLIENT_ID
            })

            const payload = ticket.getPayload()
            req.user = {
                googleId: payload?.sub,
                email: payload?.email,
                name: payload?.name
            }

            next()
        }
        catch (err) {
            console.error('Auth middleware error:', err)
            return res.status(401).json({ error: 'Invalid token' })
        }
    }

    async checkUserRole(req: Request, res: Response, next: NextFunction){
        try{
            const userRole = req.headers['x-user-role']
            const sessionId = req.body.sessionId

            if(userRole === 'guest'){
                // check redis key for number of messages for this session
                if(this.redisClient && this.isConnected && sessionId){
                    try {
                        const sessionKey = `session:${sessionId}`
                        const sessionData = await this.redisClient.get(sessionKey)
                        
                        if(sessionData){
                            const session = JSON.parse(sessionData)
                            const messageCount = session.messages ? session.messages.length : 0
                            
                            console.log(`[AUTH MIDDLEWARE] Guest user session ${sessionId} has ${messageCount} messages`)
                            
                            if(messageCount >= 6){
                                return res.status(401).json({
                                    error: "User Login required - Guest users limited to 3 messages"
                                })
                            }
                        }
                    } catch (redisErr) {
                        console.error('[AUTH MIDDLEWARE] Redis error in checkUserRole:', redisErr)
                        // Continue if Redis fails
                    }
                }
                return next()
            }

            if(userRole === 'user'){
                return next()
            }

            return res.status(401).json({
                error: "Invalid User role"
            })
        }
        catch(err){
            console.error('[AUTH MIDDLEWARE] checkUserRole error:', err)
            return res.status(500).json({
                error: "Server Error"
            })
        }
    }
}

export const authMiddleware = new AuthMiddleware()