import { InferenceClient } from "@huggingface/inference"
import { cacheService } from "./cache.service"

// Translation model mapping for different language pairs
// Note: These models support bidirectional translation
const TRANSLATION_MODELS: Record<string, string> = {
    'es': 'Helsinki-NLP/opus-mt-en-es',  // English ↔ Spanish
    'fr': 'Helsinki-NLP/opus-mt-en-fr',  // English ↔ French
    'de': 'Helsinki-NLP/opus-mt-en-de',  // English ↔ German
    'hi': 'Helsinki-NLP/opus-mt-en-hi', // English ↔ Hindi
    'en': 'Helsinki-NLP/opus-mt-es-en',  // Spanish to English (can be used for reverse)
}

class TranslateService {
    private client: InferenceClient | null = null

    constructor() {
        const apiKey = process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN
        if (apiKey) {
            this.client = new InferenceClient(apiKey)
        } else {
            console.warn('[TRANSLATE SERVICE] ⚠️ HUGGINGFACE_API_KEY not set. Translation will fallback to original text.')
        }
    }

    /**
     * Translate text using Hugging Face with streaming
     * Uses text generation with translation prompt for true streaming
     */
    async translateStream(
        text: string, 
        targetLocale: string, 
        onToken: (token: string, accumulated: string) => void
    ): Promise<string> {
        // If no API key, return original
        if (!this.client || !targetLocale) {
            return text;
        }

        // Check cache first
        const cached = await cacheService.getCachedTranslation(text, targetLocale);
        if (cached) {
            // Stream cached translation word by word for smooth UX
            const words = cached.split(' ');
            let accumulated = '';
            for (const word of words) {
                accumulated += (accumulated ? ' ' : '') + word;
                onToken(word + ' ', accumulated);
                await new Promise(resolve => setTimeout(resolve, 20));
            }
            return cached;
        }

        const languageNames: Record<string, string> = {
            'es': 'Spanish',
            'fr': 'French',
            'de': 'German',
            'hi': 'Hindi',
            'en': 'English'
        }

        const targetLanguage = languageNames[targetLocale]
        if (!targetLanguage) {
            return text
        }

        try {
            // Use chat completion with translation prompt for streaming
            // For English, translate FROM detected language TO English
            // For other languages, translate FROM English TO target language
            const prompt = targetLocale === 'en'
                ? `Translate the following text to English. Only output the translation, nothing else.\n\nText: ${text}\nEnglish:`
                : `Translate the following English text to ${targetLanguage}. Only output the translation, nothing else.\n\nEnglish: ${text}\n${targetLanguage}:`

            const stream = this.client.chatCompletionStream({
                model: 'meta-llama/Meta-Llama-3-8B-Instruct',
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                parameters: {
                    max_tokens: 512,
                    temperature: 0.3
                }
            })

            let accumulated = ''
            for await (const chunk of stream) {
                // Handle different response formats
                let token = ''
                
                // Chat completion format: { choices: [{ delta: { content: "..." } }] }
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
                    if (newText.length > accumulated.length) {
                        token = newText.substring(accumulated.length)
                    }
                }

                if (token && token.trim().length > 0) {
                    accumulated += token
                    onToken(token, accumulated.trim())
                }
            }

            const translatedText = accumulated.trim() || text;
            
            // Cache the translation
            await cacheService.cacheTranslation(text, translatedText, targetLocale);
            
            return translatedText;

        } catch (err) {
            console.error('[TRANSLATE SERVICE] Streaming error:', err)
            // Fallback to non-streaming translation
            return await this.translate(text, targetLocale)
        }
    }

    /**
     * Translate text using Hugging Face Translation Models (non-streaming fallback)
     */
    async translate(text: string, targetLocale: string): Promise<string> {
        // If no API key, return original
        if (!this.client || !targetLocale) {
            return text
        }

        // Check cache first
        const cached = await cacheService.getCachedTranslation(text, targetLocale);
        if (cached) {
            return cached;
        }

        const model = TRANSLATION_MODELS[targetLocale]
        if (!model) {
            return text
        }
        
        try {
            const response = await this.client.translation({
                model: model,
                inputs: text
            })

            const translatedText = typeof response === 'string' 
                ? response 
                : (response as any)?.translation_text || (response as any)?.text || ''

            const finalText = translatedText || text;
            
            // Cache the translation
            await cacheService.cacheTranslation(text, finalText, targetLocale);
            
            return finalText;

        } catch (err) {
            console.error('[TRANSLATE SERVICE] Translation error:', err)
            return text
        }
    }

    async translateMessages(messages: any[], targetLocale: string, sendEvent: (type: string, data: any) => void): Promise<any[]> {
        const translatedMessages: any[] = [];

        // Translate each message one by one with streaming
        for (let i = 0; i < messages.length; i++) {
            const message = messages[i];
            
            try {
                let translatedContent = '';
                
                // Use streaming translation
                const result = await this.translateStream(
                    message.content, 
                    targetLocale,
                    (token, accumulated) => {
                        // Stream each token as it arrives
                        translatedContent = accumulated;
                        sendEvent('token', {
                            index: i,
                            token: token,
                            accumulated: accumulated
                        });
                    }
                );

                // Ensure content is set (fallback to result or original)
                const finalContent = translatedContent || result || message.content || '';
                
                // Preserve all original message fields
                const translatedMessage = { 
                    ...message, 
                    content: finalContent
                };
                translatedMessages.push(translatedMessage);
                
                // Send complete translated message with all fields
                sendEvent('message', {
                    index: i,
                    message: translatedMessage
                });
            } catch (err) {
                console.error(`[TRANSLATE SERVICE] Error translating message ${i + 1}:`, err);
                // Use original message if translation fails
                translatedMessages.push(message);
                sendEvent('message', {
                    index: i,
                    message: message
                });
            }
        }

        // Send complete event with all messages
        sendEvent('complete', { messages: translatedMessages });
        
        return translatedMessages;
    }
}

export const translateService = new TranslateService()