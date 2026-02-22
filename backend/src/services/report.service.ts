import { chunkingService } from "../core/chunking"
import { Chunk, parseFilename } from "../core/metadata"
import { fileProcessingService } from "./file-processing.service"
import { PromptTask, promptService } from "./prompt.service"
import { llmService } from "./llm.service"
import { cacheService } from "./cache.service"

const FRONTEND_TO_BACKEND_SECTION_MAP: Record<string, string> = {
    'executive-summary': 'management_discussion',
    'risk-factors': 'risk_factors',
    'financial-overview': 'financial_performance'
};

class ReportService {
    async processReport(fileBuffer: Buffer, filename: string) {
        const pdfData = await fileProcessingService.parseFile(fileBuffer, filename)
        const metadata = parseFilename(filename)
        const sections = chunkingService.detectSections(pdfData.text)
        const chunks = chunkingService.sectionAwareChunking(pdfData.text, sections)

        return {
            text: pdfData.text,
            totalPages: pdfData.totalPages,
            metadata,
            sections,
            chunks
        }
    }

    async analyzeChunks(chunks: Chunk[]) {
        const analyses = []
        for (const chunk of chunks) {
            try {
                const prompt = promptService.getPrompt(PromptTask.REPORT_ANALYZE, {
                    content: chunk.text,
                    sectionId: chunk.sectionType
                })
                const analysis = await llmService.callWithRetry(prompt)
                analyses.push({
                    chunkId: chunk.sectionType,
                    text: chunk.text,
                    analysis: analysis
                })
            } catch (err) {
                console.error(`[REPORT SERVICE] Error analyzing chunk:`, err)
                analyses.push({
                    chunkId: chunk.sectionType,
                    text: chunk.text,
                    analysis: 'Analysis failed'
                })
            }
        }
        return analyses
    }

    async getInitialSentiment(text: string) {
        try {
            const prompt = promptService.getPrompt(PromptTask.REPORT_SENTIMENT, {
                content: text.substring(0, 1000)
            })
            return await llmService.callWithRetry(prompt)
        } catch (err) {
            console.error(`[REPORT SERVICE] Error getting sentiment:`, err)
            return null
        }
    }

    async analyzeReport(sessionId: string): Promise<any> {
        const cachedData = await cacheService.getCachedReport(sessionId);
        if (!cachedData) {
            throw new Error('Report not found. Please upload a report first.');
        }

        const { metadata, analyses, importantChunks } = cachedData;
        const companySize = this.determineCompanySize(metadata.company);
        const currentMetrics = this.parseMetrics(analyses);
        const benchmarkExamples = promptService.getBenchmarkExamples(companySize);

        const prompt = promptService.getPrompt(PromptTask.REPORT_EXPERT_ANALYSIS, {
            currentMetrics,
            importantChunks,
            companySize,
            benchmarkExamples
        });

        const expertAnalysis = await llmService.callWithRetry(prompt);
        const analysisResult = this.parseJSONResponse(expertAnalysis);

        await cacheService.cacheAnalysis(`report:analysis:${sessionId}`, analysisResult);

        return {
            success: true,
            data: {
                sessionId,
                companySize,
                currentMetrics,
                expertAnalysis: analysisResult.expertAnalysis,
                improvementSuggestions: analysisResult.improvementSuggestions,
                benchmarkComparison: analysisResult.benchmarkComparison
            }
        };
    }

    async improveReport(sessionId: string, sectionId: string): Promise<any> {
        const cachedData = await cacheService.getCachedReport(sessionId);
        if (!cachedData || !cachedData.chunks || !Array.isArray(cachedData.chunks)) {
            throw new Error('Report not found. Please upload a report first.');
        }

        const backendSectionType = FRONTEND_TO_BACKEND_SECTION_MAP[sectionId] || sectionId;
        const sectionChunks = cachedData.chunks.filter((chunk: Chunk) => 
            chunk.sectionType === backendSectionType
        );

        if (sectionChunks.length === 0) {
            throw new Error(`No chunks found for section ${sectionId}.`);
        }

        const cachedAnalysis = await cacheService.getCachedAnalysis(sessionId);
        const sectionText = sectionChunks.map((chunk: Chunk) => chunk.text).join('\n\n');
        const analysisContext = cachedAnalysis 
            ? JSON.stringify(cachedAnalysis.expertAnalysis || {}, null, 2)
            : 'No previous analysis available';

        const prompt = promptService.getPrompt(PromptTask.REPORT_IMPROVE, {
            content: sectionText,
            sectionId: backendSectionType,
            context: analysisContext
        });

        const improvedContent = await llmService.callWithRetry(prompt);
        const parsed = this.parseImprovementResponse(improvedContent);

        let finalContent = parsed.content || improvedContent;
        finalContent = this.extractContent(finalContent);
        
        if (Array.isArray(parsed.improvements) && parsed.improvements.length === 0) {
            const nested = this.tryParseNested(finalContent);
            if (nested) {
                if (nested.improvements?.length > 0) parsed.improvements = nested.improvements;
                if (nested.examples?.length > 0) parsed.examples = nested.examples;
                finalContent = this.extractContent(nested.content || finalContent);
            }
        }

        if (typeof finalContent === 'string' && (finalContent.trim().startsWith('{') || finalContent.trim().startsWith('"'))) {
            finalContent = this.extractContent(finalContent);
        }

        return {
            success: true,
            data: {
                sectionId,
                originalContent: sectionText,
                improvedContent: finalContent,
                improvements: parsed.improvements || [],
                examples: parsed.examples || []
            }
        };
    }

    private parseJSONResponse(response: string): any {
        try {
            return JSON.parse(response);
        } catch (parseErr) {
            try {
                let jsonString = response.trim();
                const codeBlockMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                if (codeBlockMatch) jsonString = codeBlockMatch[1].trim();
                
                const firstBrace = jsonString.indexOf('{');
                const lastBrace = jsonString.lastIndexOf('}');
                if (firstBrace > 0) jsonString = jsonString.substring(firstBrace);
                if (lastBrace !== -1 && lastBrace < jsonString.length - 1) {
                    jsonString = jsonString.substring(0, lastBrace + 1);
                }
                jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
                return JSON.parse(jsonString);
            } catch (extractErr) {
                console.error('[REPORT SERVICE] Failed to parse JSON:', extractErr);
                return {
                    expertAnalysis: {
                        overallAssessment: response,
                        strengths: [],
                        weaknesses: [],
                        comparisonWithPeers: ''
                    },
                    improvementSuggestions: [],
                    benchmarkComparison: {}
                };
            }
        }
    }

    private parseImprovementResponse(response: string): any {
        try {
            let jsonString = response.trim();
            const codeBlockMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (codeBlockMatch) jsonString = codeBlockMatch[1].trim();
            
            const firstBrace = jsonString.indexOf('{');
            const lastBrace = jsonString.lastIndexOf('}');
            if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
                throw new Error('No valid JSON found');
            }
            
            jsonString = jsonString.substring(firstBrace, lastBrace + 1);
            let cleanedJson = jsonString.replace(/,(\s*[}\]])/g, '$1');
            
            let openBraces = (cleanedJson.match(/\{/g) || []).length;
            let closeBraces = (cleanedJson.match(/\}/g) || []).length;
            let openBrackets = (cleanedJson.match(/\[/g) || []).length;
            let closeBrackets = (cleanedJson.match(/\]/g) || []).length;
            
            while (openBrackets > closeBrackets) {
                cleanedJson += ']';
                closeBrackets++;
            }
            while (openBraces > closeBraces) {
                cleanedJson += '}';
                closeBraces++;
            }
            cleanedJson = cleanedJson.replace(/,(\s*[}\]])/g, '$1');
            
            cleanedJson = this.fixControlCharacters(cleanedJson);
            
            const parsed = JSON.parse(cleanedJson);
            
            return {
                content: parsed.content || response,
                improvements: Array.isArray(parsed.improvements) 
                    ? parsed.improvements.map((imp: any) => ({
                        type: imp.type || 'clarity',
                        description: imp.description || '',
                        before: imp.before || '',
                        after: imp.after || ''
                    })).filter((imp: any) => imp.description && imp.before && imp.after)
                    : [],
                examples: Array.isArray(parsed.examples) 
                    ? parsed.examples.filter((ex: any) => typeof ex === 'string' && ex.trim().length > 0)
                    : []
            };
        } catch (err) {
            console.error('[REPORT SERVICE] Error parsing improvement:', err);
            return { 
                content: response, 
                improvements: [], 
                examples: [] 
            };
        }
    }

    private fixControlCharacters(jsonString: string): string {
        let result = '';
        let inString = false;
        let escapeNext = false;
        
        for (let i = 0; i < jsonString.length; i++) {
            const char = jsonString[i];
            const prevChar = i > 0 ? jsonString[i - 1] : '';
            
            if (escapeNext) {
                result += char;
                escapeNext = false;
                continue;
            }
            
            if (char === '\\') {
                result += char;
                escapeNext = true;
                continue;
            }
            
            if (char === '"' && prevChar !== '\\') {
                inString = !inString;
                result += char;
                continue;
            }
            
            if (inString) {
                if (char === '\n') {
                    result += '\\n';
                } else if (char === '\r') {
                    result += '\\r';
                } else if (char === '\t') {
                    result += '\\t';
                } else if (char.charCodeAt(0) < 32) {
                    result += '\\u' + ('0000' + char.charCodeAt(0).toString(16)).slice(-4);
                } else {
                    result += char;
                }
            } else {
                result += char;
            }
        }
        
        return result;
    }

    private extractContent(content: any): string {
        if (typeof content !== 'string') {
            if (content && typeof content === 'object' && content.content) {
                return this.extractContent(content.content);
            }
            return String(content || '');
        }
        
        const trimmed = content.trim();
        if (!trimmed) return content;
        
        if (!trimmed.startsWith('{') && !trimmed.startsWith('"')) {
            return content;
        }

        try {
            const parsed = JSON.parse(trimmed);
            if (typeof parsed === 'string') {
                return parsed;
            }
            if (parsed && typeof parsed === 'object') {
                if (parsed.content) {
                    return this.extractContent(parsed.content);
                }
                if (parsed.improvements || parsed.examples) {
                    return content;
                }
            }
        } catch (e) {
            try {
                if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
                    const unescaped = trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
                    return this.extractContent(unescaped);
                }
            } catch (e2) {
                // Fall through
            }
        }

        return content;
    }

    private tryParseNested(content: string): any {
        if (typeof content !== 'string') return null;
        
        const trimmed = content.trim();
        if (!trimmed.startsWith('{')) return null;

        try {
            const parsed = JSON.parse(trimmed);
            if (parsed && typeof parsed === 'object') {
                return {
                    content: parsed.content,
                    improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
                    examples: Array.isArray(parsed.examples) ? parsed.examples : []
                };
            }
        } catch (e) {
            // Not a valid JSON
        }

        return null;
    }

    private determineCompanySize(companyName: string): string {
        const largeCap = ['reliance', 'tata', 'infosys', 'tcs', 'hdfc', 'icici'];
        const mediumCap = ['wipro', 'tech mahindra', 'lt', 'bharti'];
        const companyLower = companyName.toLowerCase();
        
        if (largeCap.some(name => companyLower.includes(name))) return 'large_cap';
        if (mediumCap.some(name => companyLower.includes(name))) return 'medium_cap';
        return 'small_cap';
    }

    private parseMetrics(analyses: any[]): any {
        const metrics = {
            totalRiskCount: 0,
            avgSentimentScore: 0,
            avgComplexityScore: 0,
            riskTransparency: 'medium',
            assertiveness: 'medium',
            readability: 'Grade 12',
            revenue: null as string | null
        };

        let validAnalyses = 0;
        let totalSentiment = 0;
        let totalComplexity = 0;

        for (const analysis of analyses) {
            try {
                const analysisJson = JSON.parse(analysis.analysis);
                const data = analysisJson.analysis || analysisJson;
                
                metrics.totalRiskCount += (data.riskFactors || []).length;
                totalSentiment += data.sentimentScore || 0;
                totalComplexity += data.complexityScore || 0;
                
                if (data.keyMetrics?.length && !metrics.revenue) {
                    for (const metric of data.keyMetrics) {
                        if (typeof metric === 'string') {
                            const revenueMatch = metric.match(/revenue[:\s]+([₹$€£]?\s*[\d,]+\.?\d*\s*(?:lakh|crore|million|billion|thousand)?)/i);
                            if (revenueMatch) {
                                metrics.revenue = revenueMatch[1].trim();
                                break;
                            }
                        }
                    }
                }
                
                if (!metrics.revenue && analysis.text) {
                    const revenueMatch = analysis.text.match(/revenue[:\s]+([₹$€£]?\s*[\d,]+\.?\d*\s*(?:lakh|crore|million|billion|thousand)?)/i);
                    if (revenueMatch) metrics.revenue = revenueMatch[1].trim();
                }
                
                if (data.riskTransparency) metrics.riskTransparency = data.riskTransparency;
                if (data.assertiveness) metrics.assertiveness = data.assertiveness;
                if (data.readability) metrics.readability = data.readability;
                
                validAnalyses++;
            } catch (err) {
                // Skip invalid
            }
        }

        if (validAnalyses > 0) {
            metrics.avgSentimentScore = Math.round(totalSentiment / validAnalyses);
            metrics.avgComplexityScore = Math.round(totalComplexity / validAnalyses);
        }

        return metrics;
    }
}

export const reportService = new ReportService()
