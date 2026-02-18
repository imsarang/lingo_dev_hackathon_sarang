import { Request, Response } from 'express'
import { questionService } from '../services/question.service'

export class QuestionController {
    async ask(req: Request, res: Response) {
        try {
            const { query, documentId, company } = req.body

            if (!query) {
                return res.status(400).json({ error: 'Query is required' })
            }

            const result = await questionService.handleQuery(query, {
                documentId,
                company
            })
            
            res.status(200).json(result)
        } catch (error) {
            console.error('Question error:', error)
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    }
}

export const questionController = new QuestionController()