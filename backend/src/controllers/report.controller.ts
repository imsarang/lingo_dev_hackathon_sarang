import {Request, Response} from 'express'
import { reportService } from '../services/report.service'
import { sessionService } from '../services/session.service'
import { cacheService } from '../services/cache.service'

class ReportController {
    async uploadReport(req: Request, res: Response){
        try{
            if(!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "No File uploaded"
                })
            }

            // Create new session for this report
            const sessionId = sessionService.createSession()

            // process file and create chunks
            const result = await reportService.processReport(
                req.file.buffer,
                req.file.originalname
            )

            // get intitial sentiment
            const sentiment = await reportService.getInitialSentiment(result.text)
            
            // analyze chunks
            const analyses = await reportService.analyzeChunks(result.chunks)

            // Cache report data
            await cacheService.cacheReport({
                metadata: result.metadata,
                sentiment: sentiment || '',
                analyses: analyses,
                chunks: result.chunks
            }, sessionId)

            // Cache sections for section-wise improvements
            await cacheService.cacheReportSections(result.sections, sessionId)

            return res.status(200).json({
                success: true,
                data: {
                    sessionId: sessionId,
                    totalPages: result.totalPages,
                    metadata: result.metadata,
                    sections: result.sections.map(s => ({
                        type: s.type,
                        startIndex: s.startIndex,
                        endIndex: s.endIndex,

                    })),
                    chunks: result.chunks.map((chunk, index) => ({
                        id: index,
                        text: chunk.text,
                        sectionType: chunk.sectionType
                    })),
                    sentiment,
                    analyses
                }
            })
        }
        catch(err){
            console.error('[REPORT CONTROLLER] Error:', err);
            return res.status(500).json({
                success: false,
                message: err instanceof Error ? err.message : 'Internal server error'
            })
        }
    }

    async analyzeReport(req: Request, res: Response){
        try{
            const sessionId = req.body.sessionId || req.params.sessionId;
            
            if (!sessionId) {
                return res.status(400).json({
                    success: false,
                    message: "Session ID is required"
                });
            }

            const result = await reportService.analyzeReport(sessionId);
            return res.status(200).json(result);
        }
        catch(err){
            console.error('[REPORT CONTROLLER] Error in analyzeReport:', err);
            return res.status(500).json({
                success: false,
                message: err instanceof Error ? err.message : "Internal Server Error"
            })
        }
    }

    async improveReport(req: Request, res: Response){
        try{
            const { sessionId, sectionId } = req.body;
            
            if (!sessionId || !sectionId) {
                return res.status(400).json({
                    success: false,
                    message: "Session ID and Section ID are required"
                });
            }

            const result = await reportService.improveReport(sessionId, sectionId);
            return res.status(200).json(result);
        }   
        catch(err){
            console.error('[REPORT CONTROLLER] Error in improveReport:', err);
            return res.status(500).json({
                success: false,
                message: err instanceof Error ? err.message : "Internal Server Error"
            })
        }
    }

    async getReport(req: Request, res: Response){
        try{
            const sessionIdParam = req.params.sessionId || req.query.sessionId;
            const sessionId = Array.isArray(sessionIdParam) ? sessionIdParam[0] : sessionIdParam;
            
            if (!sessionId || typeof sessionId !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: "Session ID is required"
                });
            }

            const cachedReport = await cacheService.getCachedReport(sessionId);
            const cachedSections = await cacheService.getCachedSections(sessionId);
            const cachedAnalysis = await cacheService.getCachedAnalysis(sessionId);

            if (!cachedReport) {
                return res.status(404).json({
                    success: false,
                    message: "Report not found"
                });
            }

            return res.status(200).json({
                success: true,
                data: {
                    sessionId,
                    metadata: cachedReport.metadata,
                    sentiment: cachedReport.sentiment,
                    analyses: cachedReport.analyses || [],
                    chunks: cachedReport.chunks || [],
                    sections: cachedSections || [],
                    expertAnalysis: cachedAnalysis || null
                }
            });
        }
        catch(err){
            console.error('[REPORT CONTROLLER] Error in getReport:', err);
            return res.status(500).json({
                success: false,
                message: err instanceof Error ? err.message : "Internal Server Error"
            })
        }
    }
}

export const reportController = new ReportController()