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
    private readonly SIMILARITY_THRESHOLD: number = 0.85; // Lowered from 0.95 for better cache hits

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
            const allSimilarities: Array<{question: string, similarity: number}> = []

            console.log(`[CACHE SERVICE] Checking ${keys.length} cached questions for similarity...`)

            for(const key of keys){
                const cachedData = await this.client.get(key)
                if(!cachedData) continue;

                const cached: CachedResponse = JSON.parse(cachedData)
                const similarity = this.cosineSimilarity(questionEmbedding, cached.embedding)
                
                allSimilarities.push({ question: cached.question, similarity })

                if(similarity > bestSimilarity && similarity >= this.SIMILARITY_THRESHOLD){
                    bestSimilarity = similarity
                    bestMatch = cached
                }
            }

            // Log top similarities for debugging
            if(allSimilarities.length > 0){
                const sorted = allSimilarities.sort((a, b) => b.similarity - a.similarity)
                const top3 = sorted.slice(0, 3)
                console.log(`[CACHE SERVICE] Top similarities:`)
                top3.forEach((item, idx) => {
                    console.log(`  ${idx + 1}. "${item.question.substring(0, 60)}..." - ${(item.similarity * 100).toFixed(2)}%`)
                })
            }

            if(bestMatch){
                console.log(`[CACHE SERVICE] ✅ Cache HIT! Similarity: ${(bestSimilarity * 100).toFixed(2)}% (threshold: ${(this.SIMILARITY_THRESHOLD * 100).toFixed(0)}%)`);
            } else {
                console.log(`[CACHE SERVICE] ❌ Cache MISS - Best similarity: ${bestSimilarity > 0 ? (bestSimilarity * 100).toFixed(2) + '%' : 'N/A'} (threshold: ${(this.SIMILARITY_THRESHOLD * 100).toFixed(0)}%)`)
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

    // Translation caching methods
    async getCachedTranslation(text: string, locale: string): Promise<string | null> {
        if (!this.client || !this.isConnected) return null;

        try {
            const textHash = Buffer.from(text).toString('base64').substring(0, 20);
            const key = `cache:${locale}:${textHash}`;
            
            const cached = await this.client.get(key);
            if (cached) {
                const data = JSON.parse(cached);
                // Check if it's a translation (has translatedText) vs RAG response (has answer)
                if (data.translatedText) {
                    console.log(`[CACHE SERVICE] ✅ Translation cache HIT for locale: ${locale}`);
                    return data.translatedText;
                }
                // If it's a RAG cache entry (has answer), ignore it
            }
            
            return null;
        } catch (err) {
            console.error('[CACHE SERVICE] Error getting cached translation:', err);
            return null;
        }
    }

    async cacheTranslation(text: string, translatedText: string, locale: string): Promise<void> {
        if (!this.client || !this.isConnected) return;

        try {
            const textHash = Buffer.from(text).toString('base64').substring(0, 20);
            const key = `cache:${locale}:${textHash}`;
            
            const data = {
                originalText: text,
                translatedText: translatedText,
                locale: locale,
                timestamp: new Date().toISOString()
            };
            
            // Cache for 24 hours (translations don't change)
            // Note: Uses same key pattern as RAG cache, but different data structure
            await this.client.setEx(key, 86400, JSON.stringify(data));
            console.log(`[CACHE SERVICE] 💾 Cached translation for locale: ${locale}`);
        } catch (err) {
            console.error('[CACHE SERVICE] Error caching translation:', err);
        }
    }

    async cacheReport(
        report: {
            metadata: { company: string, year: number, documentType: string },
            sentiment: string,
            analyses: Array<{ chunkId: string, text: string, analysis: string }>,
            chunks: Array<{ text: string, sectionType: string }>
        },
        sessionId: string
    ): Promise<void> {
        if (!this.client || !this.isConnected) {
            console.warn('[CACHE SERVICE] ⚠️ Redis not connected, skipping report cache');
            return;
        }

        try {
            const key = `report:${sessionId}`;
            const importantChunks: Array<{ chunkId: string, text: string, analysis: string }> = [];

            for (const item of report.analyses) {
                try {
                    const analysisJson = JSON.parse(item.analysis);
                    const metrics = analysisJson.analysis || analysisJson;
                    
                    // Score calculation: complexity + sentiment + risk factors
                    const complexityScore = metrics.complexityScore || 0;
                    const sentimentScore = metrics.sentimentScore || 0;
                    const riskCount = (metrics.riskFactors || []).length;
                    const metricsCount = (metrics.keyMetrics || []).length;
                    
                    // Total importance score
                    const importanceScore = complexityScore * 0.3 + sentimentScore * 0.3 + riskCount * 10 + metricsCount * 5;
                    
                    // Keep chunks with score > 50
                    if (importanceScore > 50) {
                        importantChunks.push(item);
                    }
                } catch (parseErr) {
                    console.warn(`[CACHE SERVICE] Could not parse analysis for chunk ${item.chunkId}`);
                }
            }

            const cacheData = {
                metadata: report.metadata,
                sentiment: report.sentiment,
                analyses: report.analyses,
                importantChunks: importantChunks,
                timestamp: new Date().toISOString()
            };

            await this.client.setEx(key, 86400, JSON.stringify(cacheData));
            console.log(`[CACHE SERVICE] 💾 Cached report: ${key} (${importantChunks.length} important chunks)`);
        } catch (err) {
            console.error('[CACHE SERVICE] Error caching report:', err);
            throw err;
        }
    }

    async getCachedReport(sessionId: string): Promise<any | null> {
        if (!this.client || !this.isConnected) {
            console.warn('[CACHE SERVICE] ⚠️ Redis not connected');
            return null;
        }
        
        try {
            const key = `report:${sessionId}`;
            const data = await this.client.get(key);
            return data ? JSON.parse(data) : null;
        } catch (err) {
            console.error('[CACHE SERVICE] Error getting cached report:', err);
            return null;
        }
    }

    async cacheAnalysis(key: string, analysisData: any): Promise<void> {
        if (!this.client || !this.isConnected) {
            console.warn('[CACHE SERVICE] ⚠️ Redis not connected, skipping analysis cache');
            return;
        }

        try {
            await this.client.setEx(key, 86400, JSON.stringify(analysisData));
            console.log(`[CACHE SERVICE] 💾 Cached analysis: ${key}`);
        } catch (err) {
            console.error('[CACHE SERVICE] Error caching analysis:', err);
        }
    }
}

export const cacheService = new CacheService()