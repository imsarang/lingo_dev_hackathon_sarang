import { RedisClientType, createClient} from "redis";
import { v4 as uuidv4 } from 'uuid';

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
}

interface ConversationSession {
    sessionId: string;
    messages: Message[];
    createdAt: Date;
    lastAccessedAt: Date;
}

class SessionService {
    private client: RedisClientType | null = null
    private isConnected: boolean = false
    private readonly sessionTTL: number = 3600 // 1 hour
    private readonly maxHistoryLength: number = 100

    constructor() {
        this._initRedis()
    }

    private async _initRedis(){
        try{
            if(!this.client){
                this.client = createClient({
                    url: process.env.REDIS_URL || 'redis://localhost:6379'
                })

                this.client.on('error', (err) => {
                    console.error('[SESSION SERVICE] Redis error:', err)
                    this.isConnected = false
                })

                this.client.on('connect', () => {
                    console.log('[SESSION SERVICE] Connected to Redis')
                    this.isConnected = true
                })

                await this.client.connect()

                console.log('[SESSION SERVICE] Redis connected successfully')
            }
        }
        catch(err){
            console.error('[SESSION SERVICE] Failed to connect to Redis:', err)
            throw err
        }
    }

    createSession(): string{
        return uuidv4()
    }

    // get history
    async getHistory(sessionId: string){
        console.log(`\n[SESSION SERVICE] Getting history for session: ${sessionId}`)
        
        if(!this.client || !this.isConnected){
            console.warn('[SESSION SERVICE] ⚠️ Redis client not connected')
            return []
        }

        try{
            const key = `session:${sessionId}`
            console.log(`[SESSION SERVICE] Fetching from Redis key: ${key}`)
            
            const data = await this.client.get(key)
            if(!data){
                console.log('[SESSION SERVICE] ℹ️ No existing session found, returning empty history')
                return []
            }
            
            const session: ConversationSession = JSON.parse(data)
            console.log(`[SESSION SERVICE] ✅ Found ${session.messages.length} messages`)
            console.log(`[SESSION SERVICE] Session created at: ${session.createdAt}`)
            console.log(`[SESSION SERVICE] Last accessed: ${session.lastAccessedAt}`)
            
            session.messages = session.messages.map((msg: Message) => ({
                ...msg,
                timestamp: new Date(msg.timestamp)
            }))

            session.lastAccessedAt = new Date()
            await this.client.setEx(key, this.sessionTTL, JSON.stringify(session))
            console.log(`[SESSION SERVICE] Session TTL refreshed (${this.sessionTTL}s)\n`)
            return session.messages
            
        }
        catch(err){
            console.error('[SESSION SERVICE] ❌ Failed to get history:', err)
            return []
        }
    }

    // add message for context
    async addMessage(sessionId: string , role: 'user' | 'assistant' | 'system', content: string){
        console.log(`\n[SESSION SERVICE] Adding message to session: ${sessionId}`)
        console.log(`[SESSION SERVICE] Role: ${role}`)
        console.log(`[SESSION SERVICE] Content length: ${content.length} chars`)
        
        if(!this.client || !this.isConnected){
            console.warn('[SESSION SERVICE] ⚠️ Redis client not connected, message not saved')
            return
        }

        try{
            const key = `session:${sessionId}`
            const history = await this.getHistory(sessionId)

            const newMessage: Message = {
                role, content, timestamp: new Date()
            }

            history.push(newMessage)
            console.log(`[SESSION SERVICE] Message added, total messages: ${history.length}`)

            const trimmedHistory = history.slice(-this.maxHistoryLength)
            if(trimmedHistory.length < history.length) {
                console.log(`[SESSION SERVICE] ✂️ History trimmed from ${history.length} to ${trimmedHistory.length} messages`)
            }

            const session: ConversationSession = {
                sessionId,
                messages: trimmedHistory,
                createdAt: history[0].timestamp,
                lastAccessedAt: new Date()
            }

            await this.client.setEx(key, this.sessionTTL, JSON.stringify(session))
            console.log(`[SESSION SERVICE] ✅ Session saved to Redis\n`)
        }
        catch(err){
            console.error('[SESSION SERVICE] ❌ Failed to add message:', err)
        }
    }

    async clearSession(sessionId: string): Promise<void> {
        if(!this.client || !this.isConnected){
            console.warn('[SESSION SERVICE] Redis client not connected')
            return
        }

        try{
            const key = `session:${sessionId}`
            await this.client.del(key)
        }
        catch(err){
            console.error('[SESSION SERVICE] Failed to clear session:', err)
        }
    }

    formatHistoryForContext(messages: Message[], maxMessages: number = 5): string{
        console.log(`\n[SESSION SERVICE] Formatting history for context`)
        console.log(`[SESSION SERVICE] Total messages: ${messages.length}, Max to include: ${maxMessages}`)
        
        if(messages.length === 0) {
            console.log('[SESSION SERVICE] ℹ️ No messages to format\n')
            return ''
        }

        const recentMessages = messages.slice(-maxMessages)
        console.log(`[SESSION SERVICE] Using ${recentMessages.length} most recent messages`)

        const formatted = recentMessages
            .map(msg => `${msg.role === 'user' ? 'User: ' : msg.role === 'assistant' ? 'Assistant: ' : 'System: '}${msg.content}`)
            .join('\n')
        
        console.log(`[SESSION SERVICE] ✅ Formatted history length: ${formatted.length} chars\n`)
        return formatted
    }

    async disconnect(){
        if(this.client && this.isConnected){
            await this.client.disconnect()
            console.log('[SESSION SERVICE] Redis client disconnected')
            this.isConnected = false
            this.client = null
        }
    }

}

export const sessionService = new SessionService()