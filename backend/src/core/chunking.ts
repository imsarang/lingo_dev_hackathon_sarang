import { SECTION_PATTERNS, Section, Chunk } from './metadata'

class ChunkingService {
    
    // Simple section detection
    detectSections(text: string): Section[] {
        const sections: Section[] = []
        
        for (const sectionDef of SECTION_PATTERNS) {
            const match = text.search(sectionDef.pattern)
            if (match !== -1) {
                sections.push({
                    type: sectionDef.type,
                    startIndex: match
                })
            }
        }
        
        sections.sort((a, b) => a.startIndex - b.startIndex)
        
        // Set end positions
        for (let i = 0; i < sections.length; i++) {
            sections[i].endIndex = sections[i + 1]?.startIndex || text.length
        }
        
        return sections
    }
    
    // Section-aware chunking - simplified
    sectionAwareChunking(text: string, sections: Section[]): Chunk[] {
        const chunks: Chunk[] = []
        
        if (sections.length === 0) {
            // No sections - chunk normally
            const textChunks = this.simpleChunk(text, 600)
            return textChunks.map(t => ({ text: t, sectionType: 'other' }))
        }
        
        // Chunk each section
        for (const section of sections) {
            const sectionText = text.substring(section.startIndex, section.endIndex)
            const textChunks = this.simpleChunk(sectionText, 600)
            
            for (const chunk of textChunks) {
                chunks.push({ text: chunk, sectionType: section.type })
            }
        }
        
        return chunks
    }
    
    // Simple chunking by paragraphs
    private simpleChunk(text: string, maxSize: number): string[] {
        const chunks: string[] = []
        const paragraphs = text.split(/\n\n+/)
        
        let current = ''
        
        for (const para of paragraphs) {
            if (current.length + para.length > maxSize && current) {
                chunks.push(current.trim())
                current = para
            } else {
                current += (current ? '\n\n' : '') + para
            }
        }
        
        if (current.trim()) chunks.push(current.trim())
        
        return chunks
    }
    
    // Keep old method for backward compatibility
    semnaticChunking(text: string, metadata?: any): any[] {
        const chunks = this.simpleChunk(text, 600)
        return chunks.map((chunk, i) => ({
            text: chunk,
            metadata: { ...metadata, chunkIndex: i }
        }))
    }
    
    semanticChunking(text: string, chunkSize: number = 600): string[] {
        return this.simpleChunk(text, chunkSize)
    }
    
    fixedSizeChunking(text: string, chunkSize: number = 500): string[] {
        const chunks: string[] = []
        for (let i = 0; i < text.length; i += chunkSize) {
            chunks.push(text.slice(i, i + chunkSize))
        }
        return chunks
    }
}

export const chunkingService = new ChunkingService()
