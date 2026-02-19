interface LibreTranslateResponse {
    translatedText: string
    detectedLanguage?: {
        confidence: number
        language: string
    }
}

class TranslateService {
    private apiUrl: string = 'https://libretranslate.com/translate'

    /**
     * Translate text using LibreTranslate (free, no API key required)
     * Supported locales: en, es, fr, de, hi, and many more
     */
    async translate(text: string, targetLocale: string): Promise<string> {
        console.log(`\n[TRANSLATE SERVICE] Translation request`)
        console.log(`[TRANSLATE SERVICE] Target locale: ${targetLocale}`)
        console.log(`[TRANSLATE SERVICE] Text length: ${text.length} chars`)
        console.log(`[TRANSLATE SERVICE] Text preview: ${text.substring(0, 80)}${text.length > 80 ? '...' : ''}`)
        
        try {
            console.log(`[TRANSLATE SERVICE] 📡 Calling LibreTranslate API...`)
            const startTime = Date.now()

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    q: text,
                    source: 'auto',  // Auto-detect source language
                    target: targetLocale,
                    format: 'text'
                })
            })

            const duration = Date.now() - startTime
            console.log(`[TRANSLATE SERVICE] API response received in ${duration}ms, status: ${response.status}`)

            if (!response.ok) {
                const errorText = await response.text()
                console.log(`[TRANSLATE SERVICE] ⚠️ API error: ${response.status} - ${errorText}`)
                console.log('[TRANSLATE SERVICE] Returning original text as fallback')
                return text // Fallback: return original text
            }

            const data = await response.json() as LibreTranslateResponse
            
            if (!data || !data.translatedText) {
                console.log('[TRANSLATE SERVICE] ⚠️ No translation in response, returning original text')
                return text
            }

            if (data.detectedLanguage) {
                console.log(`[TRANSLATE SERVICE] Detected source language: ${data.detectedLanguage.language} (confidence: ${data.detectedLanguage.confidence})`)
            }
            
            console.log(`[TRANSLATE SERVICE] ✅ Translation successful`)
            console.log(`[TRANSLATE SERVICE] Translated text preview: ${data.translatedText.substring(0, 80)}${data.translatedText.length > 80 ? '...' : ''}\n`)
            return data.translatedText

        } catch (err) {
            console.error('[TRANSLATE SERVICE] ❌ Translation error:', err)
            console.log('[TRANSLATE SERVICE] Returning original text as fallback\n')
            // Fallback: return original text if translation fails
            return text
        }
    }
}

export const translateService = new TranslateService()