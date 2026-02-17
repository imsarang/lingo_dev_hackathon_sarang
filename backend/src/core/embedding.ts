// Embedding generation logic
import { InferenceClient } from "@huggingface/inference"

export class EmbeddingService {
    private provider: string
    private hfClient?: InferenceClient
    private lmStudioUrl: string
    private modelName: string

    constructor(){
        this.provider = process.env.EMBEDDING_PROVIDER || 'huggingface'
        this.lmStudioUrl = process.env.LLM_BASE_URL || 'http://localhost:1234/v1'
        this.modelName = process.env.EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2'
        
        if (this.provider === 'huggingface') {
            const hfToken = process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN
            this.hfClient = new InferenceClient(hfToken)
            console.log("✓ Using Hugging Face (FREE + STABLE)")
            console.log(`   Model: ${this.modelName}`)
        } else {
            console.log("✓ Using LM Studio (LOCAL - MAY CRASH)")
            console.log(`   URL: ${this.lmStudioUrl}`)
        }
    }

    async generateEmbedding(text: string): Promise<number[]> {
        if (this.provider === 'huggingface') {
            // Hugging Face Inference API - Simple and reliable
            const result = await this.hfClient!.featureExtraction({
                model: this.modelName,
                inputs: text,
            })
            return result as number[]
        } else {
            // LM Studio - crashes easily
            const response = await fetch(`${this.lmStudioUrl}/embeddings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.modelName,
                    input: text
                })
            })
            
            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(`LM Studio error: ${response.status} ${errorText}`)
            }
            
            const data: any = await response.json()
            return data.data[0].embedding
        }
    }

    // Batch embedding generation - much faster!
    async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
        if (this.provider === 'huggingface') {
            // Hugging Face supports batch processing natively
            const result = await this.hfClient!.featureExtraction({
                model: this.modelName,
                inputs: texts, // Pass array directly
            })
            return result as number[][]
        } else {
            // LM Studio batch support
            const response = await fetch(`${this.lmStudioUrl}/embeddings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.modelName,
                    input: texts // Pass array
                })
            })
            
            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(`LM Studio error: ${response.status} ${errorText}`)
            }
            
            const data: any = await response.json()
            return data.data.map((item: any) => item.embedding)
        }
    }

    getDimension(): number {
        return 384 // all-MiniLM-L6-v2 dimension (both HF and LM Studio)
    }
}

export const embeddingService = new EmbeddingService()
