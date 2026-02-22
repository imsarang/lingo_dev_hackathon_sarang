import { chunkingService } from "../core/chunking"
import { Chunk, parseFilename } from "../core/metadata"
import { fileProcessingService } from "./file-processing.service"
import { PromptTask, promptService } from "./prompt.service"
import { llmService } from "./llm.service"
import { cacheService } from "./cache.service"

class ReportService{
    async processReport(fileBuffer: Buffer, filename: string){
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

    async analyzeChunks(chunks: Chunk[]){
        const analyses = []
        for (const chunk of chunks){
            try{
                const prompt = promptService.getPrompt(PromptTask.REPORT_ANALYZE,{
                    content: chunk.text,
                    sectionId: chunk.sectionType
                })

                // Simple LLM call - no RAG, no history
                const analysis = await llmService.callWithRetry(prompt)

                analyses.push({
                    chunkId: chunk.sectionType,
                    text: chunk.text,
                    analysis: analysis
                })
            }
            catch(err){
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

    async getInitialSentiment(text: string){
        try{
            const prompt = promptService.getPrompt(PromptTask.REPORT_SENTIMENT, {
                content: text.substring(0, 1000)
            })

            // Simple LLM call - no RAG, no history
            const sentiment = await llmService.callWithRetry(prompt)
            return sentiment
        }
        catch(err){
            console.error(`[REPORT SERVICE] Error getting sentiment:`, err)
            return null
        }
    }

    async analyzeReport(sessionId: string): Promise<any> {
        try {
            // Get cached report data
            const cachedData = await cacheService.getCachedReport(sessionId);
            if (!cachedData) {
                throw new Error('Report not found. Please upload a report first.');
            }

            const { metadata, sentiment, analyses, importantChunks } = cachedData;

            // Determine company size
            const companySize = this.determineCompanySize(metadata.company);

            // Parse current metrics from analyses
            const currentMetrics = this.parseMetrics(analyses);

            // Get benchmark examples based on company size
            const benchmarkExamples = this.getBenchmarkExamples(companySize);

            // Create expert analysis prompt with few-shot examples
            const prompt = promptService.getPrompt(PromptTask.REPORT_EXPERT_ANALYSIS, {
                currentMetrics: currentMetrics,
                importantChunks: importantChunks,
                companySize: companySize,
                benchmarkExamples: benchmarkExamples
            });

            // Call LLM for expert analysis
            const expertAnalysis = await llmService.callWithRetry(prompt);

            // Parse LLM response - extract JSON from markdown if needed
            let analysisResult;
            try {
                // First, try direct JSON parse
                analysisResult = JSON.parse(expertAnalysis);
            } catch (parseErr) {
                // If direct parse fails, try to extract JSON from markdown
                try {
                    let jsonString = expertAnalysis.trim();
                    
                    // Remove markdown code blocks if present
                    const codeBlockMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                    if (codeBlockMatch) {
                        jsonString = codeBlockMatch[1].trim();
                    }
                    
                    // Remove any text before the first {
                    const firstBrace = jsonString.indexOf('{');
                    if (firstBrace > 0) {
                        jsonString = jsonString.substring(firstBrace);
                    }
                    
                    // Remove any text after the last }
                    const lastBrace = jsonString.lastIndexOf('}');
                    if (lastBrace !== -1 && lastBrace < jsonString.length - 1) {
                        jsonString = jsonString.substring(0, lastBrace + 1);
                    }
                    
                    // Remove trailing commas
                    jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
                    
                    analysisResult = JSON.parse(jsonString);
                } catch (extractErr) {
                    // If extraction also fails, wrap the raw response
                    console.error('[REPORT SERVICE] Failed to parse expert analysis JSON:', extractErr);
                    console.error('[REPORT SERVICE] Raw response:', expertAnalysis.substring(0, 500));
                    analysisResult = {
                        expertAnalysis: {
                            overallAssessment: expertAnalysis,
                            strengths: [],
                            weaknesses: [],
                            comparisonWithPeers: ''
                        },
                        improvementSuggestions: [],
                        benchmarkComparison: {}
                    };
                }
            }

            // Cache the analysis result
            const analysisCacheKey = `report:analysis:${sessionId}`;
            await cacheService.cacheAnalysis(analysisCacheKey, analysisResult);

            return {
                success: true,
                data: {
                    sessionId: sessionId,
                    companySize: companySize,
                    currentMetrics: currentMetrics,
                    expertAnalysis: analysisResult.expertAnalysis,
                    improvementSuggestions: analysisResult.improvementSuggestions,
                    benchmarkComparison: analysisResult.benchmarkComparison
                }
            };
        } catch (err) {
            console.error('[REPORT SERVICE] Error in analyzeReport:', err);
            throw err;
        }
    }

    private determineCompanySize(companyName: string): string {
        // Simple heuristic - can be improved with actual market cap data
        const largeCapCompanies = ['reliance', 'tata', 'infosys', 'tcs', 'hdfc', 'icici'];
        const mediumCapCompanies = ['wipro', 'tech mahindra', 'lt', 'bharti'];
        
        const companyLower = companyName.toLowerCase();
        
        if (largeCapCompanies.some(name => companyLower.includes(name))) {
            return 'large_cap';
        } else if (mediumCapCompanies.some(name => companyLower.includes(name))) {
            return 'medium_cap';
        } else {
            return 'small_cap';
        }
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
                
                // Extract revenue from keyMetrics
                if (data.keyMetrics && Array.isArray(data.keyMetrics)) {
                    for (const metric of data.keyMetrics) {
                        if (typeof metric === 'string') {
                            const revenueMatch = metric.match(/revenue[:\s]+([₹$€£]?\s*[\d,]+\.?\d*\s*(?:lakh|crore|million|billion|thousand)?)/i);
                            if (revenueMatch && !metrics.revenue) {
                                metrics.revenue = revenueMatch[1].trim();
                            }
                        }
                    }
                }
                
                // Also check chunk text for revenue if not found in keyMetrics
                if (!metrics.revenue && analysis.text) {
                    const revenueMatch = analysis.text.match(/revenue[:\s]+([₹$€£]?\s*[\d,]+\.?\d*\s*(?:lakh|crore|million|billion|thousand)?)/i);
                    if (revenueMatch) {
                        metrics.revenue = revenueMatch[1].trim();
                    }
                }
                
                if (data.riskTransparency) {
                    metrics.riskTransparency = data.riskTransparency;
                }
                if (data.assertiveness) {
                    metrics.assertiveness = data.assertiveness;
                }
                if (data.readability) {
                    metrics.readability = data.readability;
                }
                
                validAnalyses++;
            } catch (err) {
                // Skip invalid analyses
            }
        }

        if (validAnalyses > 0) {
            metrics.avgSentimentScore = Math.round(totalSentiment / validAnalyses);
            metrics.avgComplexityScore = Math.round(totalComplexity / validAnalyses);
        }

        return metrics;
    }

    private getBenchmarkExamples(companySize: string): string {
        const examples: Record<string, string> = {
            large_cap: `Example 1 (Large Cap - Reliance Industries):
- Revenue: ₹ 4,00,000+ crore (typical for large cap)
- Risk Transparency: High (comprehensive risk disclosure)
- Assertiveness: High (confident tone, clear projections)
- Complexity Score: 65 (moderate complexity, accessible language)
- Sentiment Score: 82 (positive outlook)

Example 2 (Large Cap - TCS):
- Revenue: ₹ 1,50,000+ crore (typical for large cap IT)
- Risk Transparency: High (detailed risk factors)
- Assertiveness: Medium-High (balanced confidence)
- Complexity Score: 58 (clear and concise)
- Sentiment Score: 85 (very positive)`,

            medium_cap: `Example 1 (Medium Cap - Tech Mahindra):
- Revenue: ₹ 30,000-50,000 crore (typical for medium cap)
- Risk Transparency: Medium (standard risk disclosure)
- Assertiveness: Medium (cautious optimism)
- Complexity Score: 62 (moderate complexity)
- Sentiment Score: 75 (positive)

Example 2 (Medium Cap - Wipro):
- Revenue: ₹ 50,000-80,000 crore (typical for medium cap)
- Risk Transparency: Medium-High (good risk coverage)
- Assertiveness: Medium (balanced approach)
- Complexity Score: 60 (accessible language)
- Sentiment Score: 78 (positive outlook)`,

            small_cap: `Example 1 (Small Cap - Typical):
- Revenue: ₹ 1,000-10,000 crore (typical for small cap)
- Risk Transparency: Low-Medium (basic risk disclosure)
- Assertiveness: Low-Medium (conservative tone)
- Complexity Score: 55 (simpler language)
- Sentiment Score: 70 (neutral to positive)

Example 2 (Small Cap - Growing Company):
- Revenue: ₹ 5,000-15,000 crore (growing small cap)
- Risk Transparency: Medium (improving disclosure)
- Assertiveness: Medium (gaining confidence)
- Complexity Score: 58 (developing sophistication)
- Sentiment Score: 72 (optimistic)`
        };

        return examples[companySize] || examples.small_cap;
    }
}

export const reportService = new ReportService()