/**
 * Simple LLM Service
 * Direct LLM calls without RAG retrieval
 * Used for report analysis and other non-conversational tasks
 */

import { InferenceClient } from "@huggingface/inference";

class LLMService {
    private client: InferenceClient | null = null;
    private readonly model: string;
    private readonly maxTokens: number;
    private readonly temperature: number;

    constructor() {
        const apiKey = process.env.HUGGINGFACE_API_KEY;
        if (apiKey) {
            this.client = new InferenceClient(apiKey);
        } else {
            console.warn('[LLM SERVICE] ⚠️ HUGGINGFACE_API_KEY not set');
        }

        this.model = process.env.HUGGINGFACE_MODEL || 'meta-llama/Meta-Llama-3-8B-Instruct';
        this.maxTokens = 512;
        this.temperature = 0.7;
    }

    /**
     * Simple LLM call - no RAG, no history
     * Just prompt → response
     */
    async call(prompt: string): Promise<string> {
        if (!this.client) {
            console.error('[LLM SERVICE] ❌ HuggingFace client not initialized');
            throw new Error('HuggingFace client not initialized');
        }

        console.log('[LLM SERVICE] 📤 Making LLM call...');
        console.log(`[LLM SERVICE] Model: ${this.model}`);
        console.log(`[LLM SERVICE] Prompt length: ${prompt.length} chars`);
        console.log(`[LLM SERVICE] Prompt preview: ${prompt.substring(0, 100)}...`);

        const startTime = Date.now();

        try {
            const response = await this.client.chatCompletion({
                model: this.model,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: this.maxTokens,
                temperature: this.temperature
            });

            const duration = Date.now() - startTime;
            const answer = response.choices[0]?.message?.content || '';

            console.log(`[LLM SERVICE] ✅ LLM call completed in ${duration}ms`);
            console.log(`[LLM SERVICE] Response length: ${answer.length} chars`);
            console.log(`[LLM SERVICE] Response preview: ${answer.substring(0, 100)}...`);

            return answer;
        } catch (error: any) {
            const duration = Date.now() - startTime;
            console.error(`[LLM SERVICE] ❌ Error after ${duration}ms:`, error);
            console.error('[LLM SERVICE] Error details:', {
                message: error.message,
                status: error.status,
                statusText: error.statusText,
                name: error.name
            });
            throw new Error(`LLM call failed: ${error.message || 'Unknown error'}`);
        }
    }

    /**
     * LLM call with retry logic
     */
    async callWithRetry(prompt: string, maxRetries: number = 3): Promise<string> {
        console.log(`[LLM SERVICE] 🔄 Starting LLM call with retry (max ${maxRetries} attempts)`);
        let lastError: any = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            console.log(`[LLM SERVICE] Attempt ${attempt}/${maxRetries}`);
            
            try {
                const result = await this.call(prompt);
                if (attempt > 1) {
                    console.log(`[LLM SERVICE] ✅ Success on attempt ${attempt}`);
                }
                return result;
            } catch (error: any) {
                lastError = error;
                const errorMessage = error.message || 'Unknown error';

                console.log(`[LLM SERVICE] ❌ Attempt ${attempt} failed: ${errorMessage}`);

                // Check if we should retry
                const isRateLimit = errorMessage.includes('rate limit') || errorMessage.includes('429');
                const isAuthError = errorMessage.includes('401') || errorMessage.includes('unauthorized');

                if (isAuthError) {
                    console.error('[LLM SERVICE] 🔒 Authentication error - stopping retries');
                    throw new Error('HuggingFace API authentication failed. Please check your API key.');
                }

                if (isRateLimit && attempt < maxRetries) {
                    const waitTime = Math.min(2000 * attempt, 10000);
                    console.warn(`[LLM SERVICE] ⚠️ Rate limit detected, waiting ${waitTime}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }

                if (attempt < maxRetries) {
                    const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                    console.warn(`[LLM SERVICE] ⚠️ Error detected, waiting ${waitTime}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }

                console.error(`[LLM SERVICE] ❌ All ${maxRetries} attempts failed`);
                throw error;
            }
        }

        console.error('[LLM SERVICE] ❌ Failed to get LLM response after all retries');
        throw lastError || new Error('Failed to get LLM response after retries');
    }
}

export const llmService = new LLMService();
