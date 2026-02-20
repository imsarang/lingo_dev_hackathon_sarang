import { Request, Response } from "express";
import { translateService } from "../services/translate.service";

class TranslateController{

    async getTranslation(req: Request, res: Response){
        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')
        res.setHeader('Access-Control-Allow-Origin', '*')

        // Helper to send SSE events
        const sendEvent = (type: string, data: any) => {
            res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`)
        }

        try {
            const {messages, targetLocale} = req.body

            if(!messages || !Array.isArray(messages) || messages.length === 0){
                sendEvent('error', {message: 'No messages provided'})
                res.end()
                return
            }

            if(!targetLocale){
                sendEvent('error', {message: 'Target locale is required'})
                res.end()
                return
            }

            // Translate messages and stream results
            await translateService.translateMessages(messages, targetLocale, sendEvent)
            res.end()
        }
        catch(error){
            console.error('Error translating messages:', error)
            sendEvent('error', {message: 'Translation failed'})
            res.end()
        }
    }
}

export const translateController = new TranslateController()