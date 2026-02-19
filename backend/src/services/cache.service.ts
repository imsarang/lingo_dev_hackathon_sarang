import { RedisClientType, createClient } from "redis"
import { vectorDBClient } from "../db/client";

interface CachedResponse {
    question: string;
    answer: string;
    embedding: number[];
    context: string[];
    timestamp: Date;
    locale: string;
}

class CacheService{
    private client: RedisClientType|null = null;
    private isConnected: boolean = false
    private readonly CACHE_TTL:number = 3600
    private readonly SIMILARITY_THRESHOLD: number = 0.95;

    constructor(){
        this._initRedis()
    }

    private async _initRedis(){
        try{
            if(!this.client){
                this.client = createClient({
                    url: process.env.REDIS_URL || 'redis://localhost:6379'
                })

                this.client.on('error', (err) => {
                    console.error('[CACHE SERVICE] Redis error: ', err)
                    this.isConnected = false
                })

                this.client.on('connect', () => {
                    console.log('[CACHE SERVICE] Connected to Redis');
                    this.isConnected = true;
                });

                await this.client.connect();
            }
        }
        catch(err){
            console.error('[CACHE SERVICE] Failed to connect to Redis:', err);
            this.isConnected = false;
        }
    }

    private cosineSimilarity(a: number[], b: number[]): number{
        if (a.length !== b.length) {
            throw new Error('Vectors must have same length for cosine similarity')
        }
        const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
        const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
        const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
        if (magnitudeA === 0 || magnitudeB === 0) {
            return 0
        }
        return dotProduct / (magnitudeA * magnitudeB)
    }

    private async getEmbedding(text: string): Promise<number[]> {
        try{
            return await vectorDBClient.getEmbedding(text)
        }
        catch(err){
            console.error('[CACHE SERVICE] Embedding error: ', err)
            throw err
        }
    }

    async findSimilarCached(question: string, locale: string): Promise<CachedResponse | null>{
        if(!this.client || !this.isConnected) return null;

        try{
            const questionEmbedding = await this.getEmbedding(question)

            const keys = await this.client.keys(`cache:${locale}:*`)
            let bestMatch: CachedResponse | null = null
            let bestSimilarity: number = 0

            for(const key of keys){
                const cachedData = await this.client.get(key)
                if(!cachedData) continue;

                const cached: CachedResponse = JSON.parse(cachedData)
                const similarity = this.cosineSimilarity(questionEmbedding, cached.embedding)

                if(similarity > bestSimilarity && similarity >= this.SIMILARITY_THRESHOLD){
                    bestSimilarity = similarity
                    bestMatch = cached
                }
            }

            if(bestMatch){
                console.log(`[CACHE SERVICE] Cache HIT! Similarity: ${(bestSimilarity * 100).toFixed(2)}%`);
            }

            return bestMatch
        }
        catch(err){
            console.error('[CACHE SERVICE] Error finding similar:', err);
            return null;
        }
    }

    async cacheResponse(
        question: string,
        answer: string,
        context: string[],
        locale: string
    ): Promise<void>{
        if(!this.client || !this.isConnected) return

        try{
            const embedding = await this.getEmbedding(question)

            const questionHash = Buffer.from(question).toString('base64').substring(0,20)
            const key = `cache:${locale}:${questionHash}`

            const cached = {
                question,
                answer,
                embedding,
                context,
                timestamp: new Date(),
                locale
            }

            await this.client.setEx(key, this.CACHE_TTL, JSON.stringify(cached))
        }
        catch(err){
            console.error('[CACHE SERVICE] Error caching:', err);
        }
    }

    async clearCache(locale?: string): Promise<void>{
        if(!this.client || !this.isConnected) return;

        try{
            const pattern = locale? `cache:${locale}:*`: `cache:*`
            const keys = await this.client.keys(pattern)

            if(keys.length > 0){
                await this.client.del(keys)
            }
        }
        catch(err){
            console.error('[CACHE SERVICE] Error clearing cache:', err)
        }
    }

    // Get cache stats (useful for monitoring - 20% new)
    async getCacheStats(): Promise<{ totalCached: number; byLocale: Record<string, number> }> {
        if (!this.client || !this.isConnected) {
            return { totalCached: 0, byLocale: {} };
        }

        try {
            const keys = await this.client.keys('cache:*');
            const byLocale: Record<string, number> = {};

            for (const key of keys) {
                const locale = key.split(':')[1];
                byLocale[locale] = (byLocale[locale] || 0) + 1;
            }

            return { totalCached: keys.length, byLocale };
        } catch (error) {
            console.error('[CACHE SERVICE] Error getting stats:', error);
            return { totalCached: 0, byLocale: {} };
        }
    }

    async disconnect() {
        if (this.client && this.isConnected) {
            await this.client.disconnect();
            this.isConnected = false;
        }
    }
}

export const cacheService = new CacheService()