import { LingoDotDevEngine } from "lingo.dev/sdk";

class TranslateLingoService {
    private engine: LingoDotDevEngine | null = null

    constructor() {
        try {
            // Initialize Lingo.dev engine
            this.engine = new LingoDotDevEngine({
                // Add your Lingo.dev configuration if needed
                // Check Lingo.dev docs for API keys or project config\
                apiKey: process.env.LINGO_DOT_DEV_API_KEY
            })
        } catch (error) {
            console.error('[TRANSLATE LINGO] Failed to initialize:', error)
        }
    }

    /**
     * Detect the language of the text
     */
    async detectLocale(text: string): Promise<string> {
        if (!this.engine) {
            console.log('[TRANSLATE LINGO] Engine not initialized, defaulting to en')
            return 'en' // Default fallback
        }

        try {
            console.log(`[TRANSLATE LINGO] Detecting locale for text: ${text.substring(0, 50)}...`)
            const detectedLocale = await this.engine.recognizeLocale(text)
            console.log(`[TRANSLATE LINGO] Detected locale: ${detectedLocale}`)
            return detectedLocale || 'en'
        } catch (error) {
            console.error('[TRANSLATE LINGO] Language detection error:', error)
            return 'en'
        }
    }

    /**
     * Translate text using Lingo.dev
     */
    async translate(text: string, targetLocale: string, sourceLocale?: string): Promise<string> {
        if (!this.engine) {
            console.warn('[TRANSLATE LINGO] Engine not initialized, returning original text')
            return text
        }

        try {
            console.log(`[TRANSLATE LINGO] Translating text (length: ${text.length}) to: ${targetLocale}`)
            
            // If source locale not provided, detect it
            const detectedSourceLocale = sourceLocale || await this.detectLocale(text)
            console.log(`[TRANSLATE LINGO] Source locale: ${detectedSourceLocale}, Target locale: ${targetLocale}`)
            
            // If source and target are the same, return original
            if (detectedSourceLocale === targetLocale) {
                console.log('[TRANSLATE LINGO] Source and target locales are the same, returning original')
                return text
            }

            // Translate using localizeText
            console.log('[TRANSLATE LINGO] Calling localizeText...')
            const translationResult = await this.engine.localizeText(text, {
                sourceLocale: detectedSourceLocale,
                targetLocale: targetLocale,
            })
            console.log(`[TRANSLATE LINGO] Translation complete (length: ${translationResult?.length || 0})`)

            return translationResult || text
        } catch (error) {
            console.error('[TRANSLATE LINGO] Translation error:', error)
            return text
        }
    }

    /**
     * Stream translation word by word (simulated for UX)
     */
    async translateStream(
        text: string,
        targetLocale: string,
        sourceLocale: string | undefined,
        onToken: (token: string, accumulated: string) => void
    ): Promise<string> {
        if (!this.engine) {
            return text
        }

        try {
            // Get full translation first
            const translated = await this.translate(text, targetLocale, sourceLocale)
            
            // Stream it word by word for smooth UX
            const words = translated.split(' ')
            let accumulated = ''
            for (const word of words) {
                accumulated += (accumulated ? ' ' : '') + word
                onToken(word + ' ', accumulated)
                await new Promise(resolve => setTimeout(resolve, 20))
            }
            
            return translated
        } catch (error) {
            console.error('[TRANSLATE LINGO] Streaming error:', error)
            return text
        }
    }
}

export const translateLingoService = new TranslateLingoService()
