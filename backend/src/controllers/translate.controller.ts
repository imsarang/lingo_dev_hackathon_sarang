import { Request, Response } from "express";
import { translateLingoService } from "../services/translate-lingo.service";

class TranslateController{

    async getTranslation(req: Request, res: Response){
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')
        res.setHeader('Access-Control-Allow-Origin', '*')

        const sendEvent = (type: string, data: any) => {
            res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`)
        }

        try {
            const {messages, targetLocale, sourceLocale} = req.body

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

            const srcLocale = sourceLocale || 'en';

            // Skip translation if source and target locales are the same
            if (srcLocale === targetLocale) {
                const translatedMessages = messages.map((msg: any) => ({ ...msg }));
                sendEvent('complete', {
                    messages: translatedMessages
                });
                res.end();
                return;
            }

            const translatedMessages: any[] = []
            
            for (let index = 0; index < messages.length; index++) {
                const message = messages[index];
                const content = message.content || '';
                
                if (!content.trim()) {
                    translatedMessages.push({ ...message, content: content });
                    sendEvent('message', {
                        index,
                        message: { ...message, content: content }
                    });
                    continue;
                }

                let accumulated = '';
                
                await translateLingoService.translateStream(
                    content,
                    targetLocale,
                    srcLocale,
                    (token: string, acc: string) => {
                        accumulated = acc;
                        sendEvent('token', {
                            index,
                            accumulated: acc
                        });
                    }
                );

                const translatedMessage = {
                    ...message,
                    content: accumulated || content
                };
                
                translatedMessages.push(translatedMessage);
                sendEvent('message', {
                    index,
                    message: translatedMessage
                });
            }

            sendEvent('complete', {
                messages: translatedMessages
            });
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