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
            console.log(`Collection ${this.collectionName} initialized`);
        }
        catch(err){
            console.log("Error initializing Chroma client", err);
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
            console.log(`Added ${documents.length} documents to collection ${this.collectionName}`);
        }
        catch(err){
            console.log("Error adding documents to Chroma client", err);
            throw err
        }
    }

    async query(
        queryText: string,  // Now accepts text instead of embeddings
        nResults: number = 5,
        filter?: Record<string, any>
    ){
        if(!this.collection) {
            await this.initialize()
        }
        try{
            const results = await this.collection?.query({
                queryTexts: [queryText],  // ChromaDB will generate embeddings automatically
                nResults,
                where:filter,
            })
            console.log(`Found ${results?.documents.length} results for query`);
            return results
        }
        catch(err){
            console.log("Error querying Chroma client", err);
            throw err
        }
    }

    async deleteCollection(): Promise<void> {
        try{
            await this.client?.deleteCollection({
                name: this.collectionName,
            })
            console.log(`Deleted collection ${this.collectionName}`);
        }
        catch(err){
            console.log("Error deleting collection", err);
            throw err
        }
    }
}

export const vectorDBClient = new VectorDBClient("lingo-dev-collection")