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
                return this.getReportImprovePrompt(
                    data.content || '', 
                    data.sectionId || '',
                    data.context || undefined
                );
            
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

    private getReportImprovePrompt(content: string, sectionId: string, context?: string): string {
        const contextPart = context ? `\n\nPrevious Analysis Context:\n${context}` : '';
        
        return `You are an expert financial report editor. Improve the following report section for clarity, professionalism, and impact.

Section: ${sectionId}
Current Content:
${content}${contextPart}

CRITICAL INSTRUCTIONS:
1. You MUST respond with ONLY valid JSON
2. Do NOT include markdown code blocks (no \`\`\`json)
3. Do NOT include any text before or after the JSON
4. Start your response with { and end with }
5. Ensure all strings are properly escaped
6. The JSON must be valid and parseable

Required JSON structure (copy this exact format):
{
  "content": "complete improved version of the entire section text",
  "improvements": [
    {
      "type": "clarity",
      "description": "brief description of what was improved",
      "before": "exact original text snippet that was changed",
      "after": "exact improved text snippet"
    }
  ],
  "examples": [
    "example of professional phrasing used",
    "example of improved clarity"
  ]
}

Rules for improvements array:
- Include 3-5 improvement items
- Each item must have: type, description, before, after
- type must be one of: "clarity", "professionalism", "structure", "tone"
- before and after should be actual text snippets from the content (20-100 characters each)
- examples array should contain 2-3 short example phrases

Return ONLY the JSON object now:`;
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

    getBenchmarkExamples(companySize: string): string {
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

export const promptService = new PromptService();
