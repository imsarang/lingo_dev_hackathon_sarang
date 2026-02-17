// Text chunking logic
export interface Textchunk{
    text: string,
    index: number,
    metadata?: Record<string, any>,
}

export class ChunkingService {
    private chunkSize: number;
    private overlap: number

    constructor(chunkSize: number = 1000, overlap: number = 200){
        this.chunkSize = chunkSize
        this.overlap = overlap
    }

    chunkText(text: string, metadata?: Record<string, any>): Textchunk[] {
        const chunks: Textchunk[] = []
        let index = 0
        let position = 0
        while(position < text.length){
            const end = Math.min(position + this.chunkSize, text.length)
            const chunkText = text.slice(position, end)

            chunks.push({
                text: chunkText,
                index: index++,
                metadata
            })

            position += this.chunkSize - this.overlap
        }
        return chunks
    }

    // for paragraph splitting
    semnaticChunking(text: string, metadata?: Record<string, any>): Textchunk[] {
        const paragraphs = text.split(/\n\n+/)
        const chunks: Textchunk[] = []
        let index = 0

        for(const paragraph of paragraphs){
            const chunkText = paragraph.trim()
            if(chunkText.length > 0){
                chunks.push({
                    text: chunkText,
                    index: index++,
                    metadata
                })
            }
        }
        return chunks
    }
}

export const chunkingService = new ChunkingService()