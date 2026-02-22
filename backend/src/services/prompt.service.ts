/**
 * Prompt Service - Centralized prompt management
 * Provides prompts based on task type
 */

export enum PromptTask {
    // Chat/Bot prompts
    CHAT_ANSWER = 'CHAT_ANSWER',
    CHAT_ANSWER_WITH_HISTORY = 'CHAT_ANSWER_WITH_HISTORY',
    
    // Report Analyzer prompts
    REPORT_ANALYZE = 'REPORT_ANALYZE',
    REPORT_IMPROVE = 'REPORT_IMPROVE',
    REPORT_KEYWORDS = 'REPORT_KEYWORDS',
    REPORT_COMPLETE = 'REPORT_COMPLETE',
    REPORT_BENCHMARK = 'REPORT_BENCHMARK',
    REPORT_SENTIMENT = 'REPORT_SENTIMENT',
    REPORT_EXPERT_ANALYSIS = 'REPORT_EXPERT_ANALYSIS',
}

class PromptService {
    /**
     * Get prompt based on task type
     */
    getPrompt(
        task: PromptTask,
        data: {
            question?: string;
            content?: string;
            context?: string;
            conversationHistory?: string;
            sectionId?: string;
            selectedText?: string;
            partialText?: string;
            sections?: any[];
            metadata?: any;
            currentMetrics?: any;
            importantChunks?: any[];
            companySize?: string;
            benchmarkExamples?: string;
        }
    ): string {
        switch (task) {
            case PromptTask.CHAT_ANSWER:
                return this.getChatAnswerPrompt(data.question || '', data.context || '');
            
            case PromptTask.CHAT_ANSWER_WITH_HISTORY:
                return this.getChatAnswerWithHistoryPrompt(
                    data.question || '',
                    data.context || '',
                    data.conversationHistory || ''
                );
            
            case PromptTask.REPORT_ANALYZE:
                return this.getReportAnalyzePrompt(data.content || '', data.sectionId || '');
            
            case PromptTask.REPORT_IMPROVE:
                return this.getReportImprovePrompt(data.content || '', data.sectionId || '');
            
            case PromptTask.REPORT_KEYWORDS:
                return this.getReportKeywordsPrompt(
                    data.content || '',
                    data.sectionId || '',
                    data.selectedText || ''
                );
            
            case PromptTask.REPORT_COMPLETE:
                return this.getReportCompletePrompt(
                    data.partialText || '',
                    data.content || '',
                    data.sectionId || ''
                );
            
            case PromptTask.REPORT_BENCHMARK:
                return this.getReportBenchmarkPrompt(data.sections || [], data.metadata || {});
            
            case PromptTask.REPORT_SENTIMENT:
                return this.getReportSentimentPrompt(data.content || '');
            
            case PromptTask.REPORT_EXPERT_ANALYSIS:
                return this.getReportExpertAnalysisPrompt(
                    data.currentMetrics || {},
                    data.importantChunks || [],
                    data.companySize || 'medium_cap',
                    data.benchmarkExamples || ''
                );
            
            default:
                throw new Error(`Unknown prompt task: ${task}`);
        }
    }

    // ========================================================================
    // Chat/Bot Prompts
    // ========================================================================

    private getChatAnswerPrompt(question: string, context: string): string {
        return `Answer the following question based on the context provided.

Context:
${context}

Question: ${question}

Answer:`;
    }

    private getChatAnswerWithHistoryPrompt(
        question: string,
        context: string,
        conversationHistory: string
    ): string {
        return `You are a helpful AI assistant. Use the conversation history and document context to answer the question.

Conversation History:
${conversationHistory}

Document Context:
${context}

Current Question: ${question}

Answer (be conversational and refer to previous context when relevant):`;
    }

    // ========================================================================
    // Report Analyzer Prompts
    // ========================================================================

    private getReportAnalyzePrompt(content: string, sectionId: string): string {
        return `Analyze the following report section and provide a detailed analysis.

Section: ${sectionId}
Content:
${content}

Provide analysis in JSON format with:
- sentiment: "positive" | "negative" | "neutral"
- sentimentScore: number (0-100)
- riskFactors: string[]
- keyMetrics: string[]
- assertiveness: "low" | "medium" | "high"
- riskTransparency: "low" | "medium" | "high"
- readability: string (e.g., "Grade 12")
- complexityScore: number (0-100)

Analysis:`;
    }

    private getReportImprovePrompt(content: string, sectionId: string): string {
        return `Improve the following report section for clarity, professionalism, and impact.

Section: ${sectionId}
Current Content:
${content}

Provide:
1. Improved version of the content
2. List of specific improvements made
3. Suggestions for further enhancement

Improved Content:`;
    }

    private getReportKeywordsPrompt(
        content: string,
        sectionId: string,
        selectedText: string
    ): string {
        const selectedPart = selectedText ? `\n\nSelected Text: ${selectedText}` : '';
        
        return `Extract industry-specific keywords and phrases from this report section.

Section: ${sectionId}
Content:
${content}${selectedPart}

Provide a list of relevant keywords and phrases that are commonly used in professional reports. Focus on:
- Industry-specific terms
- Financial terminology
- Risk-related phrases
- Professional business language

Keywords (comma-separated):`;
    }

    private getReportCompletePrompt(
        partialText: string,
        context: string,
        sectionId: string
    ): string {
        return `Complete the following partial sentence in a professional, contextually appropriate way.

Section: ${sectionId}
Context:
${context}

Partial Text: ${partialText}

Provide 3-5 completion suggestions that are:
- Professional and appropriate for a business report
- Contextually relevant
- Varying in style and approach

Completions (one per line):`;
    }

    private getReportBenchmarkPrompt(sections: any[], metadata: any): string {
        const sectionsText = sections.map(s => `${s.title}:\n${s.content}`).join('\n\n');
        
        return `Compare this report against industry standards and top company reports.

Company: ${metadata.companyName || 'Unknown'}
Industry: ${metadata.industry || 'Unknown'}
Year: ${metadata.reportYear || 'Unknown'}

Report Sections:
${sectionsText}

Provide benchmark comparison in JSON format with:
- metrics: array of {metric: string, userReport: string, industryAvg: string}
- recommendations: string[]
- overallScore: number (0-100)

Comparison:`;
    }

    private getReportSentimentPrompt(content: string): string {
        return `Analyze the sentiment and tone of the following text.

Content:
${content}

Provide sentiment analysis in JSON format:
- sentiment: "positive" | "negative" | "neutral"
- score: number (0-100)
- tone: string (e.g., "confident", "cautious", "optimistic")
- riskCount: number
- positiveSignals: number

Analysis:`;
    }

    private getReportExpertAnalysisPrompt(
        currentMetrics: any,
        importantChunks: any[],
        companySize: string,
        benchmarkExamples: string
    ): string {
        return `You are an expert financial report analyst with 20+ years of experience analyzing annual reports from Fortune 500 companies. Your task is to provide expert analysis comparing the current report with industry benchmarks.

Current Report Metrics:
${JSON.stringify(currentMetrics, null, 2)}

Important Report Sections:
${importantChunks.map((chunk, idx) => `${idx + 1}. ${chunk.chunkId}: ${chunk.text.substring(0, 200)}...`).join('\n')}

Company Size Category: ${companySize}

Benchmark Examples (${companySize} companies):
${benchmarkExamples}

CRITICAL: You must respond with ONLY valid JSON. Do NOT include markdown code blocks, explanations, or any text before or after the JSON. Return ONLY the JSON object starting with { and ending with }.

Required JSON structure:
{
  "expertAnalysis": {
    "overallAssessment": "string - overall quality assessment",
    "strengths": ["string array - key strengths"],
    "weaknesses": ["string array - key weaknesses"],
    "comparisonWithPeers": "string - how it compares to similar companies"
  },
  "improvementSuggestions": [
    {
      "priority": "high" | "medium" | "low",
      "area": "string - area to improve",
      "suggestion": "string - specific suggestion",
      "example": "string - example improvement"
    }
  ],
  "benchmarkComparison": {
    "revenue": { "current": "string", "industryAvg": "string", "status": "above" | "below" | "at" },
    "riskTransparency": { "current": "string", "industryAvg": "string", "status": "above" | "below" | "at" },
    "assertiveness": { "current": "string", "industryAvg": "string", "status": "above" | "below" | "at" },
    "complexityScore": { "current": number, "industryAvg": number, "status": "above" | "below" | "at" },
    "sentimentScore": { "current": number, "industryAvg": number, "status": "above" | "below" | "at" }
  }
}

Return ONLY the JSON object, nothing else:`;
    }
}

export const promptService = new PromptService();
