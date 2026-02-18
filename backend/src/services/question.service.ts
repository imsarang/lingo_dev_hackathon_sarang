
import { vectorDBClient } from '../db/client'
import { ChatOpenAI } from '@langchain/openai'
import { ingestionService } from './ingestion.service'
import { QuestionIntent } from '../core/metadata'

export class QuestionService {
    private llm: ChatOpenAI | null = null
    private intentCollectionName = 'query_intents'

    constructor() {
        if (process.env.OPENAI_API_KEY) {
            this.llm = new ChatOpenAI({
                modelName: "gpt-3.5-turbo",
                temperature: 0
            })
        }
    }

    // Keyword-based classification (existing)
    private classifyByKeywords(query: string): { intent: QuestionIntent, confidence: number } | null {
        const lowerQuery = query.toLowerCase()

        if (/compare|versus|vs|difference/.test(lowerQuery)) {
            return { intent: QuestionIntent.COMPARISON, confidence: 0.99 }
        }

        if (/analyze|analysis|trend|performance|growth/.test(lowerQuery)) {
            return { intent: QuestionIntent.ANALYSIS, confidence: 0.99 }
        }

        return null
    }

    // Classify intent
    async classifyIntent(query: string): Promise<{ intent: QuestionIntent, confidence: number }> {
        // Try keywords first
        const keywordResult = this.classifyByKeywords(query)
        if (keywordResult) {
            console.log(`[INTENT] ${keywordResult.intent} (keyword match)`)
            return keywordResult
        }

        // Default to INFORMATION
        console.log(`[INTENT] INFORMATION (default)`)
        return { intent: QuestionIntent.INFORMATION, confidence: 0.7 }
    }

    // Extract entities from query
    extractEntities(query: string): { companies: string[], keywords: string[] } {
        const lowerQ = query.toLowerCase()
        
        const knownCompanies = ['reliance', 'adani', 'tata', 'infosys', 'wipro']
        const companies = knownCompanies.filter(c => lowerQ.includes(c))
        
        const keywords: string[] = []
        if (/revenue|sales/.test(lowerQ)) keywords.push('revenue')
        if (/profit/.test(lowerQ)) keywords.push('profit')
        if (/risk/.test(lowerQ)) keywords.push('risk')
        
        return { companies, keywords }
    }

    // Build filters based on intent
    buildFilters(intent: QuestionIntent, entities: any): Record<string, any> {
        const filters: Record<string, any> = {}
        
        if (entities.companies.length > 0) {
            filters.company = entities.companies[0]
        }
        
        if (intent === QuestionIntent.ANALYSIS) {
            filters.intentTags = { $contains: 'analysis' }
        } else if (intent === QuestionIntent.COMPARISON) {
            // Will handle comparison specially
        }
        
        return filters
    }

    // Main handler
    async handleQuery(query: string, options?: { documentId?: string, company?: string }) {
        console.log(`\n[QUESTION] ${query}`)
        
        // 1. Classify intent
        const { intent, confidence } = await this.classifyIntent(query)
        
        // 2. Extract entities
        const entities = this.extractEntities(query)
        console.log(`[ENTITIES]`, entities)
        
        // 3. Build filters
        const filters = this.buildFilters(intent, entities)
        if (options?.company) filters.company = options.company
        if (options?.documentId) filters.documentId = options.documentId
        console.log(`[FILTERS]`, filters)
        
        // 4. Route based on intent
        if (intent === QuestionIntent.ANALYSIS) {
            return await this.handleAnalysis(query, filters)
        } else if (intent === QuestionIntent.COMPARISON) {
            return await this.handleComparison(query, entities)
        } else {
            return await this.handleInformation(query, filters)
        }
    }

    private async handleInformation(query: string, filters: Record<string, any>) {
        const { ingestionService } = require('./ingestion.service')
        const results = await ingestionService.queryVectorDatabase(query, 5, filters)
        
        return {
            intent: 'INFORMATION',
            query,
            results,
            count: results.length
        }
    }

    private async handleAnalysis(query: string, filters: Record<string, any>) {
        // Use RAG with analysis filters
        const { retrieverService } = require('../core/retriever')
        const result = await retrieverService.queryWithRAG(query, 'ANALYSIS', filters)
        
        return {
            intent: 'ANALYSIS',
            query,
            answer: result.answer,
            context: result.context.slice(0, 2)
        }
    }

    private async handleComparison(query: string, entities: any) {
        if (entities.companies.length < 2) {
            return {
                intent: 'COMPARISON',
                query,
                answer: "Please specify two companies to compare.",
                context: []
            }
        }

        // Get data for both companies
        const company1 = entities.companies[0]
        const company2 = entities.companies[1]
        
        const results1 = await ingestionService.queryVectorDatabase(query, 3, { company: company1 })
        const results2 = await ingestionService.queryVectorDatabase(query, 3, { company: company2 })
        
        return {
            intent: 'COMPARISON',
            query,
            comparison: {
                [company1]: results1,
                [company2]: results2
            }
        }
    }
}

export const questionService = new QuestionService()