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
        try {

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

            if (!response.ok) {
                const errorText = await response.text()
                return text // Fallback: return original text
            }

            const data = await response.json() as LibreTranslateResponse
            
            if (!data || !data.translatedText) {
                return text
            }

            if (data.detectedLanguage) {
            }
            return data.translatedText

        } catch (err) {
            // Fallback: return original text if translation fails
            return text
        }
    }
}

export const translateService = new TranslateService()