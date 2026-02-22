/**
 * RetrieverService - RAG (Retrieval-Augmented Generation) Service
 * 
 * This service implements a RAG workflow that:
 * 1. Retrieves relevant documents from a vector database
 * 2. Generates answers using an LLM (HuggingFace) with the retrieved context
 * 
 * Supports both streaming and non-streaming responses.
 */

import { InferenceClient } from "@huggingface/inference"
import { vectorDBClient } from "../db/client"
import { QuestionIntent } from "./metadata"
import { promptService, PromptTask } from "../services/prompt.service"

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Represents the state of the RAG workflow
 */
interface RAGState {
    question: string
    context: string[]
    answer: string
    step: 'retrieve' | 'generate' | 'complete'
    error?: string
}

/**
 * Configuration for LLM generation
 */
interface LLMConfig {
    model: string
    maxTokens: number
    temperature: number
}

/**
 * Extracted entities from a question
 */
interface ExtractedEntities {
    companies: string[]
    keywords: string[]
}

// ============================================================================
// RetrieverService Class
// ============================================================================

export class RetrieverService {
    private hfClient: InferenceClient | null = null
    private readonly llmConfig: LLMConfig

    constructor() {
        // Initialize HuggingFace Inference API client
        const apiKey = process.env.HUGGINGFACE_API_KEY
        if (!apiKey) {
            console.warn('[RETRIEVER] ⚠️ HUGGINGFACE_API_KEY not set in environment variables')
        }
        this.hfClient = new InferenceClient(apiKey || '')

        // Configure LLM settings
        this.llmConfig = {
            model: process.env.HUGGINGFACE_MODEL || 'meta-llama/Meta-Llama-3-8B-Instruct',
            maxTokens: 512,
            temperature: 0.7
        }
    }

    // ========================================================================
    // Public API Methods
    // ========================================================================

    /**
     * Main entry point for RAG queries (non-streaming)
     * Uses streaming internally and collects all tokens
     * 
     * @param question - User's question
     * @param conversationHistory - Optional conversation history for context
     * @returns Answer and retrieved context documents
     */
    async queryWithRAG(
        question: string,
        conversationHistory?: string
    ): Promise<{ answer: string, context: string[] }> {
        console.log(`[RETRIEVER] Processing question: ${question.substring(0, 100)}...`)

        // Use streaming internally and collect all tokens
        return await this.queryWithRAGStream(
            question,
            conversationHistory,
            () => {} // No-op callback since we're collecting the final answer
        )
    }

    /**
     * Main entry point for RAG queries (streaming)
     * 
     * @param question - User's question
     * @param conversationHistory - Optional conversation history for context
     * @param onToken - Callback function called for each token streamed
     * @returns Answer and retrieved context documents
     */
    async queryWithRAGStream(
        question: string,
        conversationHistory: string | undefined,
        onToken: (token: string, accumulated: string) => void
    ): Promise<{ answer: string, context: string[] }> {
        console.log(`[RETRIEVER] Processing question (streaming): ${question.substring(0, 100)}...`)

        // Step 1: Analyze question and build filters
        const filters = this.buildQueryFilters(question)

        // Step 2: Execute RAG workflow with streaming
        const state = await this.executeRAGWorkflow(question, filters, conversationHistory, onToken)

        return { answer: state.answer, context: state.context }
    }

    // ========================================================================
    // Question Analysis Methods
    // ========================================================================

    /**
     * Classifies the intent of a question
     * 
     * @param question - User's question
     * @returns Intent classification with confidence score
     */
    private classifyIntent(question: string): { intent: QuestionIntent, confidence: number } {
        const lower = question.toLowerCase()

        if (/compare|versus|vs|difference|between/.test(lower)) {
            return { intent: QuestionIntent.COMPARISON, confidence: 0.9 }
        }

        if (/analyze|analysis|trend|performance|growth|evaluate/.test(lower)) {
            return { intent: QuestionIntent.ANALYSIS, confidence: 0.9 }
        }

        return { intent: QuestionIntent.INFORMATION, confidence: 0.7 }
    }

    /**
     * Extracts entities (companies, keywords) from a question
     * 
     * @param question - User's question
     * @returns Extracted entities
     */
    private extractEntities(question: string): ExtractedEntities {
        const lower = question.toLowerCase()
        const knownCompanies = ['reliance', 'adani', 'tata', 'infosys', 'wipro']
        const companies = knownCompanies.filter(company => lower.includes(company))

        const keywords: string[] = []
        if (/revenue|sales|income/.test(lower)) keywords.push('revenue')
        if (/profit|earnings/.test(lower)) keywords.push('profit')
        if (/risk|threat/.test(lower)) keywords.push('risk')
        if (/growth|trend/.test(lower)) keywords.push('growth')

        return { companies, keywords }
    }

    /**
     * Builds database filters based on question analysis
     * 
     * @param question - User's question
     * @returns Database filters or undefined for pure semantic search
     */
    private buildQueryFilters(question: string): Record<string, any> | undefined {
        const { intent } = this.classifyIntent(question)
        const entities = this.extractEntities(question)
        const filters: Record<string, any> = {}

        // Add company filter (case-insensitive)
        if (entities.companies.length > 0) {
            const companyName = entities.companies[0]
            const capitalizedCompany = companyName.charAt(0).toUpperCase() + companyName.slice(1)
            filters.$or = [
                { company: companyName },
                { company: capitalizedCompany }
            ]
        }

        // Add intent-based section filters
        const sectionFilters: any[] = []
        if (intent === QuestionIntent.ANALYSIS) {
            sectionFilters.push(
                { sectionType: 'risk_factors' },
                { sectionType: 'financial_performance' },
                { sectionType: 'management_discussion' }
            )
        } else if (intent === QuestionIntent.COMPARISON) {
            sectionFilters.push(
                { sectionType: 'financial_performance' },
                { sectionType: 'management_discussion' }
            )
        }

        // Combine company and section filters
        if (sectionFilters.length > 0) {
            if (filters.$or) {
                // Both company and section filters exist - combine with $and
                filters.$and = [
                    { $or: filters.$or },
                    { $or: sectionFilters }
                ]
                delete filters.$or
            } else {
                // Only section filters
                filters.$or = sectionFilters
            }
        }

        // Return undefined if no filters (pure semantic search)
        return Object.keys(filters).length > 0 ? filters : undefined
    }

    // ========================================================================
    // RAG Workflow Methods
    // ========================================================================

    /**
     * Executes the RAG workflow: Retrieve → Generate → Complete
     * 
     * @param question - User's question
     * @param filters - Optional database filters
     * @param conversationHistory - Optional conversation history
     * @param onToken - Callback for streaming tokens
     * @returns Final RAG state
     */
    private async executeRAGWorkflow(
        question: string,
        filters: Record<string, any> | undefined,
        conversationHistory: string | undefined,
        onToken: (token: string, accumulated: string) => void
    ): Promise<RAGState> {
        let state: RAGState = {
            question,
            context: [],
            answer: "",
            step: 'retrieve'
        }

        // Execute workflow steps
        while (state.step !== 'complete') {
            if (state.step === 'retrieve') {
                state = await this.retrieveDocuments(state, filters)
            } else if (state.step === 'generate') {
                state = await this.generateAnswerStream(state, conversationHistory, onToken)
            }
        }

        return state
    }

    /**
     * Step 1: Retrieve relevant documents from vector database
     * 
     * @param state - Current RAG state
     * @param filters - Optional database filters
     * @returns Updated RAG state with retrieved context
     */
    private async retrieveDocuments(
        state: RAGState,
        filters?: Record<string, any>
    ): Promise<RAGState> {
        try {
            console.log('[RETRIEVER] 📥 Retrieving documents...')
            const startTime = Date.now()

            const results = await vectorDBClient.query(state.question, 5, filters)
            const context = (results?.documents?.[0] || []).filter((doc: any): doc is string => doc !== null)

            const duration = Date.now() - startTime
            console.log(`[RETRIEVER] ✅ Retrieved ${context.length} documents in ${duration}ms`)

            return { ...state, context, step: 'generate' }
        } catch (error: any) {
            console.error('[RETRIEVER] ❌ Error retrieving documents:', error.message)
            return { ...state, context: [], error: error.message, step: 'complete' }
        }
    }

    /**
     * Step 2: Generate answer using LLM (streaming)
     * 
     * @param state - Current RAG state
     * @param conversationHistory - Optional conversation history
     * @param onToken - Callback for each token
     * @returns Updated RAG state with generated answer
     */
    private async generateAnswerStream(
        state: RAGState,
        conversationHistory: string | undefined,
        onToken: (token: string, accumulated: string) => void
    ): Promise<RAGState> {
        if (state.error || state.context.length === 0) {
            return { ...state, answer: "No relevant documents found.", step: 'complete' }
        }

        if (!this.hfClient) {
            return { ...state, answer: "LLM not configured", step: 'complete' }
        }

        try {
            console.log('[RETRIEVER] 🤖 Generating answer (streaming)...')
            const prompt = this.buildPrompt(state, conversationHistory)

            const answer = await this.callLLMWithRetry(prompt, onToken)
            console.log(`[RETRIEVER] ✅ Answer generated (${answer.length} chars)`)

            return { ...state, answer, step: 'complete' }
        } catch (error: any) {
            const errorMessage = this.extractErrorMessage(error)
            console.error('[RETRIEVER] ❌ Error generating answer:', errorMessage)
            return { ...state, answer: `Error: ${errorMessage}`, error: errorMessage, step: 'complete' }
        }
    }

    // ========================================================================
    // LLM Interaction Methods
    // ========================================================================

    /**
     * Builds the prompt for LLM generation
     * Uses prompt service for chat tasks (with or without history)
     * 
     * @param state - Current RAG state
     * @param conversationHistory - Optional conversation history (only for chat)
     * @returns Formatted prompt string
     */
    private buildPrompt(state: RAGState, conversationHistory?: string): string {
        const contextText = state.context.slice(0, 3).join("\n\n")

        // Use prompt service for chat tasks
        if (conversationHistory && conversationHistory.trim().length > 0) {
            return promptService.getPrompt(PromptTask.CHAT_ANSWER_WITH_HISTORY, {
                question: state.question,
                context: contextText,
                conversationHistory: conversationHistory
            });
        }

        return promptService.getPrompt(PromptTask.CHAT_ANSWER, {
            question: state.question,
            context: contextText
        });
    }

    /**
     * Calls the LLM with retry logic (streaming only)
     * 
     * @param prompt - The prompt to send
     * @param onToken - Callback for streaming tokens
     * @returns Generated answer
     */
    private async callLLMWithRetry(
        prompt: string,
        onToken: (token: string, accumulated: string) => void
    ): Promise<string> {
        const maxRetries = 3
        let lastError: any = null

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await this.callLLMStream(prompt, onToken)
            } catch (error: any) {
                lastError = error
                const errorMessage = this.extractErrorMessage(error)

                // Check if we should retry
                const isRateLimit = errorMessage.includes('rate limit') || errorMessage.includes('429')
                const isAuthError = errorMessage.includes('401') || errorMessage.includes('unauthorized')

                if (isAuthError) {
                    throw new Error('HuggingFace API authentication failed. Please check your API key.')
                }

                if (isRateLimit && attempt < maxRetries) {
                    const waitTime = Math.min(2000 * attempt, 10000)
                    console.warn(`[RETRIEVER] ⚠️ Rate limit detected, retrying in ${waitTime}ms...`)
                    await new Promise(resolve => setTimeout(resolve, waitTime))
                    continue
                }

                if (attempt < maxRetries) {
                    const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
                    console.warn(`[RETRIEVER] ⚠️ Error detected, retrying in ${waitTime}ms...`)
                    await new Promise(resolve => setTimeout(resolve, waitTime))
                    continue
                }

                throw error
            }
        }

        throw lastError || new Error('Failed to get LLM response after retries')
    }

    /**
     * Calls the LLM (streaming)
     * Uses conversational API for models that require it
     * 
     * @param prompt - The prompt to send
     * @param onToken - Callback for each token
     * @returns Generated answer
     */
    private async callLLMStream(
        prompt: string,
        onToken: (token: string, accumulated: string) => void
    ): Promise<string> {
        if (!this.hfClient) {
            throw new Error('HuggingFace client not initialized')
        }

        try {
            // Try conversational streaming API first
            const stream = this.hfClient.chatCompletionStream({
                model: this.llmConfig.model,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: this.llmConfig.maxTokens,
                temperature: this.llmConfig.temperature,
            })

            let accumulatedAnswer = ''

            for await (const chunk of stream) {
                // Conversational streaming format: { choices: [{ delta: { content: "..." } }] }
                let token = ''
                
                if (chunk.choices && chunk.choices.length > 0) {
                    const delta = chunk.choices[0].delta
                    if (delta && delta.content && typeof delta.content === 'string') {
                        token = delta.content
                    }
                } else if (chunk.token && typeof chunk.token === 'object' && 'text' in chunk.token) {
                    // Fallback to textGeneration format
                    token = String((chunk.token as any).text)
                } else if (chunk.generated_text && typeof chunk.generated_text === 'string') {
                    // Sometimes HF sends full generated text
                    const newText = chunk.generated_text
                    if (newText.length > accumulatedAnswer.length) {
                        token = newText.substring(accumulatedAnswer.length)
                    }
                }

                if (token && token.trim().length > 0) {
                    accumulatedAnswer += token
                    onToken(token, accumulatedAnswer)
                }
            }

            if (accumulatedAnswer.length === 0) {
                throw new Error('No tokens received from HuggingFace stream')
            }

            return accumulatedAnswer
        } catch (error: any) {
            // Fallback to textGenerationStream if conversational fails
            const errorMessage = this.extractErrorMessage(error)
            if (errorMessage.includes('not supported') || errorMessage.includes('conversational')) {
                const stream = this.hfClient.textGenerationStream({
                    model: this.llmConfig.model,
                    inputs: prompt,
                    parameters: {
                        max_new_tokens: this.llmConfig.maxTokens,
                        temperature: this.llmConfig.temperature,
                        return_full_text: false,
                    }
                })

                let accumulatedAnswer = ''

                for await (const chunk of stream) {
                    let token = ''
                    if (chunk.token && typeof chunk.token === 'object' && 'text' in chunk.token) {
                        token = String(chunk.token.text)
                    } else if (chunk.generated_text && typeof chunk.generated_text === 'string') {
                        const newText = chunk.generated_text
                        if (newText.length > accumulatedAnswer.length) {
                            token = newText.substring(accumulatedAnswer.length)
                        }
                    }

                    if (token && token.trim().length > 0) {
                        accumulatedAnswer += token
                        onToken(token, accumulatedAnswer)
                    }
                }

                if (accumulatedAnswer.length === 0) {
                    throw new Error('No tokens received from HuggingFace stream')
                }

                return accumulatedAnswer
            }
            throw error
        }
    }

    // ========================================================================
    // Utility Methods
    // ========================================================================

    /**
     * Extracts error message from various error formats
     * 
     * @param error - Error object
     * @returns Error message string
     */
    private extractErrorMessage(error: any): string {
        return error?.message || error?.error || error?.toString() || 'Unknown error'
    }
}

// ============================================================================
// Export Singleton Instance
// ============================================================================

export const retrieverService = new RetrieverService()
