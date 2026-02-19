// Simplified metadata types for document ingestion

export enum QuestionIntent {
    INFORMATION = 'INFORMATION',
    ANALYSIS = 'ANALYSIS',
    COMPARISON = 'COMPARISON',
    RECOMMENDATION = 'RECOMMENDATION',
    OTHER = 'OTHER',
}

export interface DocumentMetadata {
    documentId: string
    company: string
    year: number
    documentType: string
    s3Bucket: string
    s3Key: string
}

export interface ChunkMetadata {
    documentId: string
    company: string
    year: number
    documentType: string
    sectionType: string
    intentTags: string[]
    keywords: string[]
    chunkIndex: number
    s3Bucket: string
    s3Key: string
}

export interface Section {
    type: string
    startIndex: number
    endIndex?: number
}

export interface ExtractedPDF {
    text: string
    totalPages: number
}

export interface Chunk {
    text: string
    sectionType: string
}

// Simple section patterns - just the key ones
export const SECTION_PATTERNS = [
    { type: 'risk_factors', pattern: /risk\s+factors?/i },
    { type: 'financial_performance', pattern: /financial\s+(highlights?|results?|performance)/i },
    { type: 'management_discussion', pattern: /management\s+discussion/i },
]

// Intent mapping - simplified
export const INTENT_TAGS: Record<string, string[]> = {
    risk_factors: ['analysis', 'risk'],
    financial_performance: ['analysis', 'financial'],
    management_discussion: ['analysis', 'trend'],
    other: ['information']
}

// Simple keyword extraction
export function extractKeywords(text: string): string[] {
    const keywords: string[] = []
    const lowerText = text.toLowerCase()
    
    const terms = ['revenue', 'profit', 'risk', 'growth', 'earnings', 'debt', 'assets']
    
    for (const term of terms) {
        if (lowerText.includes(term)) {
            keywords.push(term)
        }
    }
    
    // ChromaDB doesn't allow empty arrays in metadata
    return keywords.length > 0 ? keywords : ['general']
}

// Map section to intent tags
export function mapSectionToIntentTags(sectionType: string): string[] {
    const tags = INTENT_TAGS[sectionType] || INTENT_TAGS.other
    // ChromaDB doesn't allow empty arrays in metadata
    return tags.length > 0 ? tags : ['information']
}

// Parse filename for metadata (all lowercase for consistent filtering)
export function parseFilename(s3Key: string): { company: string, year: number, documentType: string } {
    const fileName = s3Key.split('/').pop() || s3Key
    const pathParts = s3Key.split('/')
    
    // Extract year
    const yearMatch = fileName.match(/20\d{2}/)
    const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear()
    
    // Extract company from path (lowercase for consistent filtering)
    const company = pathParts.length > 1 ? pathParts[0].toLowerCase() : 'unknown'
    
    // Detect document type (lowercase for consistent filtering)
    let documentType = 'report'
    if (/annual/i.test(fileName)) documentType = 'annual_report'
    else if (/quarterly/i.test(fileName)) documentType = 'quarterly_report'
    
    return {
        company,
        year,
        documentType
    }
}
