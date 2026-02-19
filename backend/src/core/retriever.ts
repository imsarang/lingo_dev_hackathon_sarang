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
                streaming: true, // Enable streaming support
            })
        }
    }

    // Classify intent from keywords
    classifyIntent(question: string): { intent: QuestionIntent, confidence: number } {
        console.log('\n[RETRIEVER] Classifying intent...')
        console.log(`[RETRIEVER] Question: ${question.substring(0, 100)}`)
        
        const lower = question.toLowerCase()

        if (/compare|versus|vs|difference|between/.test(lower)) {
            console.log('[RETRIEVER] ✅ Intent: COMPARISON (confidence: 0.9)\n')
            return { intent: QuestionIntent.COMPARISON, confidence: 0.9 }
        }

        if (/analyze|analysis|trend|performance|growth|evaluate/.test(lower)) {
            console.log('[RETRIEVER] ✅ Intent: ANALYSIS (confidence: 0.9)\n')
            return { intent: QuestionIntent.ANALYSIS, confidence: 0.9 }
        }

        // Default to INFORMATION
        console.log('[RETRIEVER] ✅ Intent: INFORMATION (confidence: 0.7)\n')
        return { intent: QuestionIntent.INFORMATION, confidence: 0.7 }
    }

    extractEntities(question: string){
        console.log('\n[RETRIEVER] Extracting entities...')
        
        const lower = question.toLowerCase()
        const knownCompanies = ['reliance', 'adani', 'tata', 'infosys', 'wipro']
        const companies = knownCompanies.filter(company => lower.includes(company)) // Keep lowercase

        const keywords = []
        if(/revenue|sales|income/.test(lower)) keywords.push('revenue')
        if(/profit|earnings/.test(lower)) keywords.push('profit')
        if(/risk|threat/.test(lower)) keywords.push('risk')
        if(/growth|trend/.test(lower)) keywords.push('growth')
        
        console.log('[RETRIEVER] Extracted entities:', { 
            companies: companies.length > 0 ? companies : 'none',
            keywords: keywords.length > 0 ? keywords : 'none'
        })
        console.log()
            
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
        console.log('\n[RETRIEVER] 📥 RETRIEVE step started')
        console.log(`[RETRIEVER] Query: ${state.question.substring(0, 100)}`)
        console.log('[RETRIEVER] Filters:', filters ? JSON.stringify(filters, null, 2) : 'none (semantic search only)')
        
        try {
            const startTime = Date.now()
            const results = await vectorDBClient.query(state.question, 5, filters)
            const duration = Date.now() - startTime
            
            const context = (results?.documents?.[0] || []).filter((doc: any): doc is string => doc !== null)
            
            console.log(`[RETRIEVER] ✅ Query completed in ${duration}ms`)
            console.log(`[RETRIEVER] Retrieved ${context.length} documents`)
            context.forEach((doc, idx) => {
                console.log(`[RETRIEVER] Doc ${idx + 1} length: ${doc.length} chars`)
            })
            console.log('[RETRIEVER] Moving to GENERATE step\n')
            
            return { ...state, context, step: 'generate' }
        } catch (error: any) {
            console.error('[RETRIEVER] ❌ Error in RETRIEVE step:', error.message)
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
    async queryWithRAG(question: string, conversationHistory?: string): Promise<{ answer: string, context: string[] }> {
        console.log('\n╔════════════════════════════════════════════╗')
        console.log('║   RETRIEVER SERVICE - RAG WORKFLOW START   ║')
        console.log('╚════════════════════════════════════════════╝')
        console.log(`[RETRIEVER] Question: ${question.substring(0, 100)}${question.length > 100 ? '...' : ''}`)
        console.log(`[RETRIEVER] Has conversation history: ${conversationHistory ? 'Yes (' + conversationHistory.length + ' chars)' : 'No'}`)
        
        // 1. Classify intent (ALWAYS)
        console.log('\n[RETRIEVER] Step 1/3: Intent Classification')
        const { intent } = this.classifyIntent(question)
        
        // 2. Extract entities (OPTIONAL - don't fail if not found)
        console.log('[RETRIEVER] Step 2/3: Entity Extraction')
        const entities = this.extractEntities(question)
        
        // 3. Build filters: Intent is ALWAYS used, company is optional
        console.log('[RETRIEVER] Step 3/3: Building Filters')
        const filters: Record<string, any> = {}
        
        // Add company filter if found (handle case variations: lowercase and capitalized)
        if (entities.companies.length > 0) {
            const companyName = entities.companies[0]
            const capitalizedCompany = companyName.charAt(0).toUpperCase() + companyName.slice(1)
            
            // Use $or to check both lowercase and capitalized versions
            filters.$or = [
                { company: companyName },
                { company: capitalizedCompany }
            ]
            console.log(`[RETRIEVER] ✅ Company filter added (case-insensitive): "${companyName}" or "${capitalizedCompany}"`)
        } else {
            console.log('[RETRIEVER] ℹ️ No company filter (none detected)')
        }
        
        // Add intent-based section filters
        // If we already have $or for company, we need to combine with section filters using $and
        const sectionFilters: any[] = []
        if (intent === QuestionIntent.ANALYSIS) {
            sectionFilters.push(
                { sectionType: 'risk_factors' },
                { sectionType: 'financial_performance' },
                { sectionType: 'management_discussion' }
            )
            console.log('[RETRIEVER] ✅ Intent-based filters added: risk_factors, financial_performance, management_discussion')
        } else if (intent === QuestionIntent.COMPARISON) {
            sectionFilters.push(
                { sectionType: 'financial_performance' },
                { sectionType: 'management_discussion' }
            )
            console.log('[RETRIEVER] ✅ Intent-based filters added: financial_performance, management_discussion')
        } else {
            console.log('[RETRIEVER] ℹ️ No intent-based filters (INFORMATION intent)')
        }
        
        // Combine company and section filters properly
        if (sectionFilters.length > 0) {
            if (filters.$or) {
                // We have both company and section filters - need to combine with $and
                // Company filter: $or with company names
                // Section filter: $or with section types
                // Combined: $and with both $or conditions
                filters.$and = [
                    { $or: filters.$or }, // Company filter
                    { $or: sectionFilters } // Section filter
                ]
                delete filters.$or // Remove the standalone $or since it's now in $and
            } else {
                // Only section filters, use $or
                filters.$or = sectionFilters
            }
        }
        
        // Only use filters if we have any (company or intent-based)
        const finalFilters = Object.keys(filters).length > 0 ? filters : undefined
        console.log('[RETRIEVER] Final filters:', finalFilters ? JSON.stringify(finalFilters, null, 2) : 'None (pure semantic search)')
  
        let state: RAGState = {
            question,
            context: [],
            answer: "",
            step: 'retrieve'
        }

        console.log('\n[RETRIEVER] ⚙️ Executing RAG state machine...')
        const workflowStartTime = Date.now()

        // Execute workflow steps
        while (state.step !== 'complete') {
            console.log(`[RETRIEVER] Current step: ${state.step.toUpperCase()}`)
            
            if (state.step === 'retrieve') {
                state = await this.retrieve(state, finalFilters)
            } else if (state.step === 'generate') {
                // state = await this.generate(state)
                state = await this.generateWithHistory(state, conversationHistory)
            }
        }

        const workflowDuration = Date.now() - workflowStartTime
        console.log(`\n[RETRIEVER] ✅ RAG workflow completed in ${workflowDuration}ms`)
        console.log(`[RETRIEVER] Answer length: ${state.answer.length} chars`)
        console.log(`[RETRIEVER] Context chunks: ${state.context.length}`)
        console.log('╔════════════════════════════════════════════╗')
        console.log('║   RETRIEVER SERVICE - RAG WORKFLOW END     ║')
        console.log('╚════════════════════════════════════════════╝\n')

        return { answer: state.answer, context: state.context }
    }

    async generateWithHistory(state: RAGState, conversationHistory?: string): Promise<RAGState> {
        console.log('\n[RETRIEVER] 🤖 GENERATE step started')
        
        try{
            if (state.error || state.context.length === 0) {
                console.log('[RETRIEVER] ⚠️ No context available (error or empty)')
                return { ...state, answer: "No relevant documents found.", step: 'complete' }
            }

            const contextText = state.context.slice(0, 3).join("\n\n")
            console.log(`[RETRIEVER] Using top 3 context chunks (${contextText.length} chars total)`)
            
            let answer: string
            if (!this.llm) {
                console.log('[RETRIEVER] ❌ No LLM configured')
                return { ...state, answer: "No LLM configured", step: 'complete' }
            }
            
            // Build better prompt with or without history
            let prompt: string
            if (conversationHistory && conversationHistory.trim().length > 0) {
                console.log('[RETRIEVER] 📜 Building prompt WITH conversation history')
                prompt = `You are a helpful AI assistant. Use the conversation history and document context to answer the question.

Conversation History:
${conversationHistory}

Document Context:
${contextText}

Current Question: ${state.question}

Answer (be conversational and refer to previous context when relevant):`
            } else {
                console.log('[RETRIEVER] 📝 Building prompt WITHOUT conversation history')
                prompt = `Answer the following question based on the context provided.

Context:
${contextText}

Question: ${state.question}

Answer:`
            }
            
            console.log(`[RETRIEVER] Prompt length: ${prompt.length} chars`)
            console.log('[RETRIEVER] 🔄 Calling LLM...')
            
            // Retry logic for GPU errors (Vulkan ErrorDeviceLost)
            const maxRetries = 3
            let lastError: any = null
            let response: any = null
            
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const llmStartTime = Date.now()
                    response = await this.llm.invoke(prompt)
                    const llmDuration = Date.now() - llmStartTime
                    
                    answer = response.content.toString()
                    console.log(`[RETRIEVER] ✅ LLM response received in ${llmDuration}ms (attempt ${attempt}/${maxRetries})`)
                    console.log(`[RETRIEVER] Answer length: ${answer.length} chars`)
                    console.log(`[RETRIEVER] Answer preview: ${answer.substring(0, 100)}${answer.length > 100 ? '...' : ''}`)
                    console.log('[RETRIEVER] Moving to COMPLETE step\n')
                    
                    return { ...state, answer, step: 'complete' }
                } catch (retryError: any) {
                    lastError = retryError
                    const isGpuError = retryError.message?.includes('ErrorDeviceLost') || 
                                     retryError.message?.includes('vk::') ||
                                     retryError.message?.includes('device lost')
                    
                    if (isGpuError && attempt < maxRetries) {
                        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000) // Exponential backoff, max 5s
                        console.warn(`[RETRIEVER] ⚠️ GPU error detected (attempt ${attempt}/${maxRetries}): ${retryError.message}`)
                        console.log(`[RETRIEVER] 🔄 Retrying in ${waitTime}ms...`)
                        await new Promise(resolve => setTimeout(resolve, waitTime))
                        continue
                    } else {
                        throw retryError
                    }
                }
            }
            
            // Should not reach here, but just in case
            throw lastError || new Error('Failed to get LLM response after retries')
        }
        catch(error: any){
            const isGpuError = error.message?.includes('ErrorDeviceLost') || 
                             error.message?.includes('vk::') ||
                             error.message?.includes('device lost')
            
            if (isGpuError) {
                console.error('[RETRIEVER] ❌ Error in GENERATE step (GPU Error):', error.message)
                console.error('[RETRIEVER] 💡 Suggestion: Restart lm-studio or check GPU status (nvidia-smi)')
                return { 
                    ...state, 
                    answer: "The AI model server encountered a GPU error. Please try again or restart the model server.", 
                    error: `GPU Error: ${error.message}`, 
                    step: 'complete' 
                }
            } else {
                console.error('[RETRIEVER] ❌ Error in GENERATE step:', error.message)
                return { ...state, answer: "Error generating answer", error: error.message, step: 'complete' }
            }
        }
    }

    // Streaming version of generateWithHistory
    async generateWithHistoryStream(
        state: RAGState,
        conversationHistory: string | undefined,
        onToken: (token: string, accumulated: string) => void
    ): Promise<RAGState> {
        console.log('\n[RETRIEVER] 🤖 GENERATE STREAM step started')
        
        try {
            if (state.error || state.context.length === 0) {
                console.log('[RETRIEVER] ⚠️ No context available (error or empty)')
                return { ...state, answer: "No relevant documents found.", step: 'complete' }
            }

            const contextText = state.context.slice(0, 3).join("\n\n")
            console.log(`[RETRIEVER] Using top 3 context chunks (${contextText.length} chars total)`)
            
            if (!this.llm) {
                console.log('[RETRIEVER] ❌ No LLM configured')
                return { ...state, answer: "No LLM configured", step: 'complete' }
            }

            // Build prompt (same as non-streaming version)
            let prompt: string
            if (conversationHistory && conversationHistory.trim().length > 0) {
                console.log('[RETRIEVER] 📜 Building prompt WITH conversation history')
                prompt = `You are a helpful AI assistant. Use the conversation history and document context to answer the question.

Conversation History:
${conversationHistory}

Document Context:
${contextText}

Current Question: ${state.question}

Answer (be conversational and refer to previous context when relevant):`
            } else {
                console.log('[RETRIEVER] 📝 Building prompt WITHOUT conversation history')
                prompt = `Answer the following question based on the context provided.

Context:
${contextText}

Question: ${state.question}

Answer:`
            }

            console.log(`[RETRIEVER] Prompt length: ${prompt.length} chars`)
            console.log('[RETRIEVER] 🔄 Calling LLM with streaming...')

            // STREAMING: Use stream() instead of invoke()
            let accumulatedAnswer = ''
            const maxRetries = 3
            let lastError: any = null

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    console.log(`[RETRIEVER] 🔄 Attempting to stream (attempt ${attempt}/${maxRetries})...`)
                    const stream = await this.llm.stream(prompt)
                    console.log('[RETRIEVER] ✅ Stream object created, type:', typeof stream)
                    
                    let chunkCount = 0
                    let hasIterated = false
                    
                    // Process stream chunk by chunk
                    try {
                        for await (const chunk of stream) {
                            hasIterated = true
                            chunkCount++
                            
                            // Debug: Log chunk structure
                            if (chunkCount === 1) {
                                console.log('[RETRIEVER] 🔍 First chunk structure:', {
                                    hasContent: !!chunk.content,
                                    contentType: typeof chunk.content,
                                    contentValue: chunk.content ? String(chunk.content).substring(0, 100) : 'null',
                                    chunkKeys: Object.keys(chunk),
                                    chunkType: chunk.constructor.name,
                                    chunkString: JSON.stringify(chunk).substring(0, 200)
                                })
                            }
                            
                            // Handle different chunk formats
                            let token = ''
                            if (chunk.content !== undefined && chunk.content !== null) {
                                token = typeof chunk.content === 'string' 
                                    ? chunk.content 
                                    : String(chunk.content)
                            } else if (chunk.text !== undefined && chunk.text !== null) {
                                token = String(chunk.text)
                            } else if (typeof chunk === 'string') {
                                token = chunk
                            } else {
                                // Try to extract text from any property
                                const chunkStr = JSON.stringify(chunk)
                                console.log(`[RETRIEVER] ⚠️ Unexpected chunk format (chunk ${chunkCount}):`, chunkStr.substring(0, 200))
                                continue
                            }
                            
                            if (token && token.trim().length > 0) {
                                accumulatedAnswer += token
                                // Call callback for each token
                                onToken(token, accumulatedAnswer)
                            }
                        }
                        
                        if (!hasIterated) {
                            console.log('[RETRIEVER] ⚠️ Stream iterator did not yield any chunks')
                        }
                    } catch (streamError: any) {
                        console.error('[RETRIEVER] ❌ Error iterating stream:', streamError)
                        throw streamError
                    }

                    console.log(`[RETRIEVER] ✅ LLM streaming completed (attempt ${attempt}/${maxRetries})`)
                    console.log(`[RETRIEVER] Total chunks received: ${chunkCount}`)
                    console.log(`[RETRIEVER] Answer length: ${accumulatedAnswer.length} chars`)
                    
                    // If no tokens were received, fall back to non-streaming method
                    if (accumulatedAnswer.length === 0) {
                        console.log('[RETRIEVER] ⚠️ No tokens received from stream, falling back to non-streaming invoke()')
                        try {
                            // Create a fresh LLM instance for fallback to avoid state corruption
                            // The original instance might be in a bad state after stream() call
                            const fallbackLLM = new ChatOpenAI({
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
                            
                            console.log('[RETRIEVER] 🔄 Using fresh LLM instance for fallback invoke()')
                            const response = await fallbackLLM.invoke(prompt)
                            accumulatedAnswer = response.content.toString()
                            console.log(`[RETRIEVER] ✅ Fallback invoke() successful, answer length: ${accumulatedAnswer.length} chars`)
                            
                            // Stream the answer word by word for smooth UX
                            if (accumulatedAnswer && accumulatedAnswer.length > 0) {
                                const words = accumulatedAnswer.split(' ')
                                let streamedAnswer = ''
                                for (const word of words) {
                                    streamedAnswer += (streamedAnswer ? ' ' : '') + word
                                    onToken(word + ' ', streamedAnswer)
                                    // Small delay for smooth streaming effect
                                    await new Promise(resolve => setTimeout(resolve, 10))
                                }
                            }
                        } catch (fallbackError: any) {
                            console.error('[RETRIEVER] ❌ Fallback invoke() also failed:', fallbackError)
                            
                            // Check if it's a GPU error
                            const errorMessage = fallbackError?.message || fallbackError?.error || fallbackError?.toString() || 'Unknown error'
                            const errorString = String(errorMessage)
                            const isGpuError = errorString.includes('ErrorDeviceLost') || 
                                             errorString.includes('vk::') ||
                                             errorString.includes('device lost') ||
                                             errorString.includes('GPU')
                            
                            if (isGpuError) {
                                throw new Error(`GPU Error: ${errorString}. Please restart LM Studio or check GPU status.`)
                            } else {
                                throw new Error(`Streaming failed and fallback failed: ${errorString}`)
                            }
                        }
                    }
                    
                    console.log('[RETRIEVER] Moving to COMPLETE step\n')
                    
                    return { ...state, answer: accumulatedAnswer, step: 'complete' }
                } catch (retryError: any) {
                    lastError = retryError
                    // Check multiple error properties for GPU errors
                    const errorMessage = retryError?.message || retryError?.error || retryError?.toString() || ''
                    const errorString = String(errorMessage)
                    const isGpuError = errorString.includes('ErrorDeviceLost') || 
                                     errorString.includes('vk::') ||
                                     errorString.includes('device lost') ||
                                     errorString.includes('GPU')
                    
                    if (isGpuError && attempt < maxRetries) {
                        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
                        console.warn(`[RETRIEVER] ⚠️ GPU error detected (attempt ${attempt}/${maxRetries}): ${errorString}`)
                        console.log(`[RETRIEVER] 🔄 Retrying in ${waitTime}ms...`)
                        await new Promise(resolve => setTimeout(resolve, waitTime))
                        continue
                    } else {
                        throw retryError
                    }
                }
            }

            throw lastError || new Error('Failed to get LLM response after retries')
        } catch (error: any) {
            // Handle undefined error - check multiple error properties
            const errorMessage = error?.message || error?.error || error?.toString() || 'Unknown error'
            const errorString = String(errorMessage)
            
            const isGpuError = errorString.includes('ErrorDeviceLost') || 
                             errorString.includes('vk::') ||
                             errorString.includes('device lost') ||
                             errorString.includes('GPU')
            
            if (isGpuError) {
                console.error('[RETRIEVER] ❌ Error in GENERATE STREAM step (GPU Error):', errorString)
                console.error('[RETRIEVER] 💡 Suggestion: Restart LM Studio or check GPU status (nvidia-smi)')
                return { 
                    ...state, 
                    answer: "The AI model server encountered a GPU error. Please try again in a moment, or restart LM Studio if the issue persists.", 
                    error: `GPU Error: ${errorString}`, 
                    step: 'complete' 
                }
            } else {
                console.error('[RETRIEVER] ❌ Error in GENERATE STREAM step:', errorString)
                console.error('[RETRIEVER] Full error object:', error)
                return { 
                    ...state, 
                    answer: `Error generating answer: ${errorString}`, 
                    error: errorString, 
                    step: 'complete' 
                }
            }
        }
    }

    // Streaming version of queryWithRAG
    async queryWithRAGStream(
        question: string,
        conversationHistory: string | undefined,
        onToken: (token: string, accumulated: string) => void
    ): Promise<{ answer: string, context: string[] }> {
        // Same intent classification and filtering as before
        const { intent } = this.classifyIntent(question)
        const entities = this.extractEntities(question)
        
        const filters: Record<string, any> = {}
        if (entities.companies.length > 0) {
            const companyName = entities.companies[0]
            const capitalizedCompany = companyName.charAt(0).toUpperCase() + companyName.slice(1)
            filters.$or = [
                { company: companyName },
                { company: capitalizedCompany }
            ]
        }
        
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
        
        if (sectionFilters.length > 0) {
            if (filters.$or) {
                filters.$and = [
                    { $or: filters.$or },
                    { $or: sectionFilters }
                ]
                delete filters.$or
            } else {
                filters.$or = sectionFilters
            }
        }
        
        const finalFilters = Object.keys(filters).length > 0 ? filters : undefined

        let state: RAGState = {
            question,
            context: [],
            answer: "",
            step: 'retrieve'
        }

        // Execute workflow
        while (state.step !== 'complete') {
            if (state.step === 'retrieve') {
                state = await this.retrieve(state, finalFilters)
            } else if (state.step === 'generate') {
                // Use streaming version
                state = await this.generateWithHistoryStream(
                    state,
                    conversationHistory,
                    onToken
                )
            }
        }

        return { answer: state.answer, context: state.context }
    }
}

export const retrieverService = new RetrieverService()
