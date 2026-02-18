// Retrieval logic with state-machine RAG
import { ChatOpenAI } from "@langchain/openai"
import { vectorDBClient } from "../db/client"
import { QuestionIntent } from "./metadata"

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
        if (process.env.OPENAI_API_KEY) {
            this.llm = new ChatOpenAI({
                modelName: "gpt-3.5-turbo",
                temperature: 0.7
            })
        }
    }

    extractEntities(question: string){
        const lower = question.toLowerCase()
        const knownCompanies = ['reliance', 'adani', 'tata', 'infosys', 'wipro']
        const companies = knownCompanies.filter(company => lower.includes(company))

        const keywords = []
        if(/revenue|sales|income/.test(lower)) keywords.push('revenue')
        if(/profit|earnings/.test(lower)) keywords.push('profit')
        if(/risk|threat/.test(lower)) keywords.push('risk')
        if(/growth|trend/.test(lower)) keywords.push('growth')
            
        return {companies, keywords}
    }

    buildFilters(intent: string, entities: any){
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
        else {
            // no filter
        }
        return filters
    }

    // Node 1: Retrieve
    async retrieve(state: RAGState): Promise<RAGState> {
        console.log(`[RETRIEVE] ${state.question}`)
        try {
            const results = await vectorDBClient.query(state.question, 5)
            const context = (results?.documents?.[0] || []).filter((doc: any): doc is string => doc !== null)
            console.log(`[RETRIEVE] Found ${context.length} docs`)
            return { ...state, context, step: 'generate' }
        } catch (error: any) {
            console.error("[RETRIEVE] Error:", error.message)
            return { ...state, context: [], error: error.message, step: 'complete' }
        }
    }

    // Node 2: Generate
    async generate(state: RAGState): Promise<RAGState> {
        console.log(`[GENERATE] Creating answer`)
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
            console.error("[GENERATE] Error:", error.message)
            return { ...state, answer: "Error generating answer", error: error.message, step: 'complete' }
        }
    }

    // Run RAG workflow (Graph-style state machine)
    async queryWithRAG(question: string, intent?: string, filters?: Record<string, any>): Promise<{ answer: string, context: string[] }> {
        console.log("\n=== RAG Workflow (State Machine) ===")
        
        const entities = this.extractEntities(question)

        const finalFilters = filters || this.buildFilters(intent || QuestionIntent.INFORMATION, entities)
  
        let state: RAGState = {
            question,
            context: [],
            answer: "",
            step: 'retrieve'
        }

        // Execute workflow steps
        while (state.step !== 'complete') {
            if (state.step === 'retrieve') {
                state = await this.retrieve(state)
            } else if (state.step === 'generate') {
                state = await this.generate(state)
            }
        }

        console.log("=== Workflow Complete ===\n")
        return { answer: state.answer, context: state.context }
    }
}

export const retrieverService = new RetrieverService()
