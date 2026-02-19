// Retrieval logic with state-machine RAG
import { ChatOpenAI } from "@langchain/openai"
import { vectorDBClient } from "../db/client"
import { QuestionIntent } from "./metadata"
import { InferenceClient } from "@huggingface/inference"

// State for RAG workflow
interface RAGState {
    question: string
    context: string[]
    answer: string
    step: 'retrieve' | 'generate' | 'complete'
    error?: string
}

export class RetrieverService {
    private llm: ChatOpenAI | null = null

    constructor() {
        // Initialize LLM if OpenAI is available
        // if(!this.llm){
        //     this.llm = new InferenceClient(process.env.HUGGINGFACE_API_KEY as string)
        // }
        if(!this.llm){
            this.llm = new ChatOpenAI({
                model: "llama-3.2-1b-instruct",
                openAIApiKey: 'lm-studio',
                configuration: {
                    baseURL: 'http://127.0.0.1:1234/v1'
                },
                temperature: 0.7,
                maxTokens: 512,
                maxRetries: 3,
                timeout: 600000,
            })
        }
    }

    // Classify intent from keywords
    classifyIntent(question: string): { intent: QuestionIntent, confidence: number } {
        const lower = question.toLowerCase()

        if (/compare|versus|vs|difference|between/.test(lower)) {
            return { intent: QuestionIntent.COMPARISON, confidence: 0.9 }
        }

        if (/analyze|analysis|trend|performance|growth|evaluate/.test(lower)) {
            return { intent: QuestionIntent.ANALYSIS, confidence: 0.9 }
        }

        // Default to INFORMATION
        return { intent: QuestionIntent.INFORMATION, confidence: 0.7 }
    }

    extractEntities(question: string){
        const lower = question.toLowerCase()
        const knownCompanies = ['reliance', 'adani', 'tata', 'infosys', 'wipro']
        const companies = knownCompanies.filter(company => lower.includes(company)) // Keep lowercase

        const keywords = []
        if(/revenue|sales|income/.test(lower)) keywords.push('revenue')
        if(/profit|earnings/.test(lower)) keywords.push('profit')
        if(/risk|threat/.test(lower)) keywords.push('risk')
        if(/growth|trend/.test(lower)) keywords.push('growth')
            
        return {companies, keywords}
    }

    buildFilters(intent: string, entities: any): Record<string, any> | undefined {
        const filters: Record<string, any> = {}

        if(entities.companies.length > 0) filters.company = entities.companies[0]

        if(intent === QuestionIntent.ANALYSIS){
            filters.$or = [
                { sectionType: 'risk_factors' },
                { sectionType: 'financial_performance' },
                { sectionType: 'management_discussion' }
            ]
        }
        else if (intent === QuestionIntent.COMPARISON){
            filters.$or = [
                { sectionType: 'financial_performance' },
                { sectionType: 'management_discussion' }
            ]
        }
        
        // Return undefined if no filters (pure semantic search!)
        return Object.keys(filters).length > 0 ? filters : undefined
    }

    // Node 1: Retrieve
    async retrieve(state: RAGState, filters?: Record<string, any>): Promise<RAGState> {
        try {
            const results = await vectorDBClient.query(state.question, 5, filters)
            const context = (results?.documents?.[0] || []).filter((doc: any): doc is string => doc !== null)
            return { ...state, context, step: 'generate' }
        } catch (error: any) {
            return { ...state, context: [], error: error.message, step: 'complete' }
        }
    }

    // Node 2: Generate
    async generate(state: RAGState): Promise<RAGState> {
        try {
            if (state.error || state.context.length === 0) {
                return { ...state, answer: "No relevant documents found.", step: 'complete' }
            }

            const contextText = state.context.slice(0, 3).join("\n\n")
            
            let answer: string
            if (this.llm) {
                const prompt = `Answer based on context:\n\nContext:\n${contextText}\n\nQuestion: ${state.question}\n\nAnswer:`
                const response = await this.llm.invoke(prompt)
                answer = response.content.toString()
            } else {
                answer = `Context: ${contextText.substring(0, 300)}...`
            }

            return { ...state, answer, step: 'complete' }
        } catch (error: any) {
            return { ...state, answer: "Error generating answer", error: error.message, step: 'complete' }
        }
    }

    // Run RAG workflow (Graph-style state machine)
    async queryWithRAG(question: string): Promise<{ answer: string, context: string[] }> {
        // 1. Classify intent (ALWAYS)
        const { intent } = this.classifyIntent(question)
        
        // 2. Extract entities (OPTIONAL - don't fail if not found)
        const entities = this.extractEntities(question)
        
        // 3. Build filters: Intent is ALWAYS used, company is optional
        const filters: Record<string, any> = {}
        
        // Add company filter if found
        if (entities.companies.length > 0) {
            filters.company = entities.companies[0]
        }
        
        // Add intent-based section filters
        if (intent === QuestionIntent.ANALYSIS) {
            filters.$or = [
                { sectionType: 'risk_factors' },
                { sectionType: 'financial_performance' },
                { sectionType: 'management_discussion' }
            ]
        } else if (intent === QuestionIntent.COMPARISON) {
            filters.$or = [
                { sectionType: 'financial_performance' },
                { sectionType: 'management_discussion' }
            ]
        }
        
        // Only use filters if we have any (company or intent-based)
        const finalFilters = Object.keys(filters).length > 0 ? filters : undefined
  
        let state: RAGState = {
            question,
            context: [],
            answer: "",
            step: 'retrieve'
        }

        // Execute workflow steps
        while (state.step !== 'complete') {
            if (state.step === 'retrieve') {
                state = await this.retrieve(state, finalFilters)
            } else if (state.step === 'generate') {
                state = await this.generate(state)
            }
        }

        return { answer: state.answer, context: state.context }
    }
}

export const retrieverService = new RetrieverService()
