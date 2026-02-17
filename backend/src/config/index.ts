// Configuration management
export const config = {
    // Server
    port: process.env.PORT || 3000,
    
    // AWS S3
    aws: {
        region: process.env.AWS_REGION || 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
    
    // OpenAI
    openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    },
    
    // ChromaDB
    chroma: {
        url: process.env.CHROMA_URL || 'http://localhost:8000',
        collectionName: process.env.CHROMA_COLLECTION_NAME || 'lingo-dev-collection',
    },
    
    // Chunking
    chunking: {
        chunkSize: parseInt(process.env.CHUNK_SIZE || '1000'),
        overlap: parseInt(process.env.CHUNK_OVERLAP || '200'),
    },
}