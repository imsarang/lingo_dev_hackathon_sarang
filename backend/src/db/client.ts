import { ChromaClient, Collection } from "chromadb"
export class VectorDBClient {
    private client: ChromaClient | null = null
    private collectionName: string
    private collection: Collection | undefined = undefined

    constructor(collectionName: string) {
        if(!this.client){
            this.client = new ChromaClient({
                path: process.env.CHROMA_URL || "http://localhost:8000"
            })
        }        

        this.collectionName = collectionName
    }

    async initialize(): Promise<void> {
        try{
            this.collection = await this.client?.getOrCreateCollection({
                name: this.collectionName,
                metadata: {
                    'hnsw:space': 'cosine',
                }
                // ChromaDB will use default embedding function to auto-generate embeddings
            })
        }
        catch(err){
            throw err
        }
    }

    async addDocuments(
        ids: string[],
        documents: string[],
        metadatas: Record<string, any>[],
        embeddings?: number[][]  // Optional - if not provided, ChromaDB will generate them
    ): Promise<void> {
        if(!this.collection) {
            await this.initialize()
        }
        try{
            const addParams: any = {
                ids,
                documents,
                metadatas,
            }
            
            // Only include embeddings if provided
            if (embeddings) {
                addParams.embeddings = embeddings
            }
            
            await this.collection?.add(addParams)
        }
        catch(err){
            throw err
        }
    }

    async query(
        queryText: string,
        nResults: number = 5,
        filter?: Record<string, any>
    ){
        console.log('\n[VECTOR DB] Query started')
        console.log(`[VECTOR DB] Query text: ${queryText.substring(0, 100)}${queryText.length > 100 ? '...' : ''}`)
        console.log(`[VECTOR DB] Requested results: ${nResults}`)
        console.log('[VECTOR DB] Filter:', filter ? JSON.stringify(filter, null, 2) : 'none')
        
        if(!this.collection) {
            console.log('[VECTOR DB] Collection not initialized, initializing...')
            await this.initialize()
            console.log('[VECTOR DB] ✅ Collection initialized')
        }
        
        try{
            const queryParams: any = {
                queryTexts: [queryText],
                nResults
            }
            
            // Only add 'where' if filter is provided and not empty
            if (filter && Object.keys(filter).length > 0) {
                queryParams.where = filter
                console.log('[VECTOR DB] Filter applied to query')
            } else {
                console.log('[VECTOR DB] No filter applied (pure semantic search)')
            }
            
            console.log('[VECTOR DB] 🔍 Executing ChromaDB query...')
            const startTime = Date.now()
            const results = await this.collection?.query(queryParams)
            const duration = Date.now() - startTime
            
            const docCount = results?.documents?.[0]?.length || 0
            
            console.log(`[VECTOR DB] ✅ Query completed in ${duration}ms`)
            console.log(`[VECTOR DB] Retrieved ${docCount} documents`)
            
            if (results?.distances && results.distances[0]) {
                console.log('[VECTOR DB] Distance scores:', results.distances[0].map((d: number | null) => d !== null ? d.toFixed(4) : 'null'))
            }
            
            if (results?.metadatas && results.metadatas[0]) {
                console.log('[VECTOR DB] Document metadata summary:')
                results.metadatas[0].forEach((meta: any, idx: number) => {
                    console.log(`[VECTOR DB]   Doc ${idx + 1}:`, {
                        company: meta?.company || 'N/A',
                        sectionType: meta?.sectionType || 'N/A',
                        year: meta?.year || 'N/A'
                    })
                })
            }
            
            console.log()
            return results
        }
        catch(err){
            console.error('[VECTOR DB] ❌ Query error:', err)
            throw err
        }
    }

    async deleteCollection(): Promise<void> {
        try{
            await this.client?.deleteCollection({
                name: this.collectionName,
            })
        }
        catch(err){
            throw err
        }
    }

    async queryEmbeddingsCollection(query: string, nResults: number = 1){
        try{
            const results = await this.collection?.query({
                queryTexts: [query],
                nResults,
            })

            return results
        }
        catch(err){
            throw err;
        }
    }

    // Get embedding for a text (for cache similarity comparison)
    async getEmbedding(text: string): Promise<number[]> {
        if(!this.collection) {
            await this.initialize()
        }
        try {
            // Query with the text to get its embedding
            // ChromaDB generates embeddings internally, but we need to extract it
            // We'll use a workaround: query and get embeddings from results
            const results = await this.collection?.query({
                queryTexts: [text],
                nResults: 1,
                include: ['embeddings']
            })
            
            // Extract embedding from results
            if (results?.embeddings && results.embeddings[0] && results.embeddings[0][0]) {
                return results.embeddings[0][0] as number[]
            }
            
            // Fallback: if embeddings not available, throw error
            throw new Error('Could not extract embedding from ChromaDB query')
        } catch (err) {
            throw err
        }
    }
}

export const vectorDBClient = new VectorDBClient("lingo-dev-collection")