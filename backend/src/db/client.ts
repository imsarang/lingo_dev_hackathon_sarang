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
        if(!this.collection) {
            await this.initialize()
        }
        try{
            
            const queryParams: any = {
                queryTexts: [queryText],
                nResults
            }
            
            // Only add 'where' if filter is provided and not empty
            if (filter && Object.keys(filter).length > 0) {
                queryParams.where = filter
            }
            
            const results = await this.collection?.query(queryParams)
            
            const docCount = results?.documents?.[0]?.length || 0
            
            return results
        }
        catch(err){
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
}

export const vectorDBClient = new VectorDBClient("lingo-dev-collection")