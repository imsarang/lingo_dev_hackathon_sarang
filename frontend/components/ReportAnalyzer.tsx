'use client';

import { useState, useEffect } from 'react';
import { useSession, getSession } from 'next-auth/react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AuthComponent } from './AuthComponent';
import LanguageSwitcher from './LanguageSwitcher';

interface ReportSection {
  id: string;
  title: string;
  content: string;
}

interface DocumentMetadata {
  companyName: string;
  industry: string;
  reportYear: string;
  companySize: string;
  riskCount: number;
  positiveSignals: number;
  sentimentScore: number;
  complexityScore: number;
}

const SECTION_LIST = [
  { id: 'executive-summary', title: 'Executive Summary' },
  { id: 'risk-factors', title: 'Risk Factors' },
  { id: 'financial-overview', title: 'Financial Overview' },
];

const SECTION_TYPE_MAP: Record<string, string> = {
  'risk_factors': 'risk-factors',
  'financial_performance': 'financial-overview',
  'management_discussion': 'executive-summary',
  'other': 'executive-summary'
};

import { API_BASE_URL } from '@/config/api';

export default function ReportAnalyzer() {
  const params = useParams();
  const locale = (params.locale as string) || 'en';
  const { data: session } = useSession();
  const [activeSection, setActiveSection] = useState<string>('executive-summary');
  const [documentMetadata, setDocumentMetadata] = useState<DocumentMetadata | null>(null);
  const [sections, setSections] = useState<ReportSection[]>(
    SECTION_LIST.map(s => ({ ...s, content: '' }))
  );
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [expertAnalysis, setExpertAnalysis] = useState<any>(null);
  const [activeView, setActiveView] = useState<'insights' | 'expert'>('insights');
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState<boolean>(false);
  const [isLoadingReport, setIsLoadingReport] = useState<boolean>(false);
  const [improvedContent, setImprovedContent] = useState<Record<string, any>>({});
  const [isImproving, setIsImproving] = useState<boolean>(false);
  
  const [originalSections, setOriginalSections] = useState<ReportSection[]>([]);
  const [originalAnalyses, setOriginalAnalyses] = useState<any[]>([]);
  const [originalExpertAnalysis, setOriginalExpertAnalysis] = useState<any>(null);
  const [originalImprovedContent, setOriginalImprovedContent] = useState<Record<string, any>>({});
  
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [translationProgress, setTranslationProgress] = useState<number>(0);

  const currentSection = sections.find(s => s.id === activeSection) || sections[0];

  const getAuthHeaders = async () => {
    const currentSession = await getSession();
    const idToken = (currentSession as any)?.idToken;
    return {
      'Content-Type': 'application/json',
      ...(idToken && { 'Authorization': `Bearer ${idToken}` })
    };
  };

  const translateText = async (text: string, targetLocale: string, sourceLocale: string = 'en'): Promise<string> => {
    if (!text || !text.trim() || sourceLocale === targetLocale) return text;
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/translate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: [{ id: 'single', type: 'user', content: text, timestamp: new Date() }],
          sourceLocale,
          targetLocale
        })
      });

      if (!response.ok) return text;

      const reader = response.body?.getReader();
      if (!reader) return text;

      const decoder = new TextDecoder();
      let textBuffer = '';
      let translatedText = text;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });
        const completeMessages = textBuffer.split('\n\n');
        textBuffer = completeMessages.pop() || '';

        for (const messageText of completeMessages) {
          if (!messageText.trim()) continue;
          
          const eventLine = messageText.match(/^event: (.+)$/m);
          const dataLine = messageText.match(/^data: (.+)$/m);
          if (!eventLine || !dataLine) continue;

          const eventType = eventLine[1];
          const eventData = JSON.parse(dataLine[1]);

          if (eventType === 'complete' && eventData.messages?.[0]?.content) {
            translatedText = eventData.messages[0].content;
          } else if (eventType === 'message' && eventData.message?.content) {
            translatedText = eventData.message.content;
          }
        }
      }

      return translatedText;
    } catch (error) {
      console.error('Translation error:', error);
      return text;
    }
  };

  const translateSectionsToEnglish = async (sectionsToTranslate: ReportSection[], sourceLocale: string): Promise<ReportSection[]> => {
    if (sourceLocale === 'en') return sectionsToTranslate;

    const translatedSections = await Promise.all(
      sectionsToTranslate.map(async (section) => {
        if (!section.content || !section.content.trim()) return section;
        const translatedContent = await translateText(section.content, 'en', sourceLocale);
        return { ...section, content: translatedContent };
      })
    );

    return translatedSections;
  };

  const parseAnalysis = (analysisText: string) => {
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.analysis || parsed;
      }
      return JSON.parse(analysisText);
    } catch (e) {
      return null;
    }
  };

  const stringToPercentage = (value: string): number => {
    const map: Record<string, number> = { 'low': 30, 'medium': 60, 'high': 90 };
    return map[value.toLowerCase()] || 50;
  };

  const getSentimentColor = (sentiment: string): string => {
    const map: Record<string, string> = {
      'positive': 'bg-green-500',
      'neutral': 'bg-yellow-500',
      'negative': 'bg-red-500'
    };
    return map[sentiment.toLowerCase()] || 'bg-gray-500';
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { text: string; class: string }> = {
      'above': { text: '↑ Above Avg', class: 'bg-green-100 text-green-700' },
      'below': { text: '↓ Below Avg', class: 'bg-red-100 text-red-700' },
      'at': { text: '→ At Avg', class: 'bg-yellow-100 text-yellow-700' }
    };
    return statusMap[status] || statusMap['at'];
  };

  const handleFileUpload = async (file: File) => {
    setIsLoadingReport(true);
    try {
      const currentSession = await getSession();
      const idToken = (currentSession as any)?.idToken;
    const formData = new FormData();
    formData.append('file', file);
    
      const response = await fetch(`${API_BASE_URL}/api/reports/upload`, {
      method: 'POST',
        headers: {
          ...(idToken && { 'Authorization': `Bearer ${idToken}` })
        },
      body: formData
    });
      
    const result = await response.json();
      
      if (!result.success) {
        alert('Upload failed: ' + result.message);
        setIsLoadingReport(false);
        return;
      }

      const data = result.data;
      setSessionId(data.sessionId);
      localStorage.setItem('reportSessionId', data.sessionId);
      const analysesData = data.analyses || [];
      setAnalyses(analysesData);
      setOriginalAnalyses(analysesData);

    setDocumentMetadata({
      companyName: data.metadata.company || 'Unknown',
      industry: data.metadata.documentType || 'Unknown',
      reportYear: data.metadata.year?.toString() || new Date().getFullYear().toString(),
        companySize: 'Unknown',
        riskCount: 0,
      positiveSignals: 0,
        sentimentScore: 0,
      complexityScore: 0
    });
    
    const sectionContent: Record<string, string> = {};
    data.chunks.forEach((chunk: any) => {
        const sectionId = SECTION_TYPE_MAP[chunk.sectionType] || 'executive-summary';
        sectionContent[sectionId] = (sectionContent[sectionId] || '') + chunk.text + '\n\n';
      });
      
      let updatedSections = sections.map(section => ({
      ...section,
      content: sectionContent[section.id] || section.content
      }));

      if (locale !== 'en') {
        const translatedSections = await translateSectionsToEnglish(updatedSections, locale);
        updatedSections = translatedSections;
      }
      
      setSections(updatedSections);
      setOriginalSections(updatedSections);
      
      // Store the locale when data is first loaded
      localStorage.setItem('reportCurrentLocale', locale);

      let totalRiskCount = 0;
      let totalSentimentScore = 0;
      let totalComplexityScore = 0;
      let analysisCount = 0;

      if (data.analyses?.length > 0) {
        data.analyses.forEach((analysis: any) => {
          try {
            const parsed = parseAnalysis(analysis.analysis);
            if (parsed) {
              if (parsed.riskFactors?.length) totalRiskCount += parsed.riskFactors.length;
              if (parsed.sentimentScore != null) {
                totalSentimentScore += Number(parsed.sentimentScore);
                analysisCount++;
              }
              if (parsed.complexityScore != null) {
                totalComplexityScore += Number(parsed.complexityScore);
              }
            }
          } catch (e) {
            // Skip invalid
          }
        });
      }

      const avgSentimentScore = analysisCount > 0 ? Math.round(totalSentimentScore / analysisCount) : 0;
      const avgComplexityScore = analysisCount > 0 ? Math.round(totalComplexityScore / analysisCount) : 0;
      const positiveSignals = avgSentimentScore > 0 ? Math.max(1, Math.round(avgSentimentScore / 10)) : 0;

      setDocumentMetadata(prev => prev ? {
        ...prev,
        riskCount: totalRiskCount,
        sentimentScore: avgSentimentScore,
        complexityScore: avgComplexityScore,
        positiveSignals
      } : null);

      setIsLoadingReport(false);
    } catch (error) {
      alert('Failed to upload file. Please try again.');
      setIsLoadingReport(false);
    }
  };

  const handleAnalyze = async () => {
    if (!sessionId) {
      alert('Please upload a report first');
      return;
    }

    setIsLoadingAnalysis(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/reports/analyze`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ sessionId })
      });

      const result = await response.json();
      
      if (!result.success) {
        alert('Analysis failed: ' + result.message);
        setIsLoadingAnalysis(false);
        return;
      }

      let expertAnalysisData = result.data;
      
      if (locale !== 'en') {
        setIsLoadingAnalysis(true);
        const ea = expertAnalysisData.expertAnalysis || {};
        
        if (ea.overallAssessment) {
          ea.overallAssessment = await translateText(ea.overallAssessment, locale, 'en');
        }
        
        if (Array.isArray(ea.strengths)) {
          ea.strengths = await Promise.all(
            ea.strengths.map((s: string) => translateText(s, locale, 'en'))
          );
        }
        
        if (Array.isArray(ea.weaknesses)) {
          ea.weaknesses = await Promise.all(
            ea.weaknesses.map((w: string) => translateText(w, locale, 'en'))
          );
        }
        
        if (ea.comparisonWithPeers) {
          ea.comparisonWithPeers = await translateText(ea.comparisonWithPeers, locale, 'en');
        }
        
        if (Array.isArray(expertAnalysisData.improvementSuggestions)) {
          expertAnalysisData.improvementSuggestions = await Promise.all(
            expertAnalysisData.improvementSuggestions.map(async (suggestion: any) => ({
              ...suggestion,
              suggestion: suggestion.suggestion ? await translateText(suggestion.suggestion, locale, 'en') : suggestion.suggestion,
              example: suggestion.example ? await translateText(suggestion.example, locale, 'en') : suggestion.example
            }))
          );
        }
        
        setIsLoadingAnalysis(false);
      }
      
      setExpertAnalysis(expertAnalysisData);
      setOriginalExpertAnalysis(expertAnalysisData);
      setActiveView('expert');

      if (result.data.companySize) {
        setDocumentMetadata(prev => prev ? {
          ...prev,
          companySize: result.data.companySize
        } : null);
      }

      setIsLoadingAnalysis(false);
    } catch (error) {
      alert('Failed to analyze report. Please try again.');
      setIsLoadingAnalysis(false);
    }
  };

  const getCurrentAnalysis = () => {
    const currentSectionType = Object.entries(SECTION_TYPE_MAP).find(
      ([_, id]) => id === activeSection
    )?.[0] || 'other';
    
    const currentAnalyses = analyses.filter((a: any) => a.chunkId === currentSectionType);
    return currentAnalyses.length > 0 ? parseAnalysis(currentAnalyses[0].analysis) : null;
  };

  const handleAIImprove = async () => {
    if (!sessionId) {
      alert('Please upload a report first');
      return;
    }

    setIsImproving(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/reports/improve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ sessionId, sectionId: activeSection })
      });

      const result = await response.json();

      if (!result.success) {
        alert('Improvement failed: ' + result.message);
        setIsImproving(false);
        return;
      }

      const data = result.data || {};
      let improvedContent = data.improvedContent || '';
      let improvements = Array.isArray(data.improvements) ? data.improvements : [];
      let examples = Array.isArray(data.examples) ? data.examples : [];
      
      const extractContent = (content: any): string => {
        if (typeof content !== 'string') {
          if (content && typeof content === 'object' && content.content) {
            return extractContent(content.content);
          }
          return String(content || '');
        }
        
        const trimmed = content.trim();
        if (!trimmed) return content;
        if (!trimmed.startsWith('{') && !trimmed.startsWith('"')) return content;
        
        try {
          const parsed = JSON.parse(trimmed);
          if (typeof parsed === 'string') return parsed;
          if (parsed && typeof parsed === 'object') {
            if (parsed.content) {
              return extractContent(parsed.content);
            }
            if (parsed.improvements || parsed.examples) {
              return content;
            }
          }
        } catch (e) {
          try {
            if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
              const unescaped = trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
              return extractContent(unescaped);
            }
          } catch (e2) {
            // Fall through
          }
        }
        return content;
      };
      
      improvedContent = extractContent(improvedContent);
      
      if (typeof improvedContent === 'string' && (improvedContent.trim().startsWith('{') || improvedContent.trim().startsWith('"'))) {
        improvedContent = extractContent(improvedContent);
      }
      
      if (improvements.length === 0 && typeof improvedContent === 'string' && improvedContent.trim().startsWith('{')) {
        try {
          const parsedJson = JSON.parse(improvedContent);
          if (parsedJson.content) {
            improvedContent = extractContent(parsedJson.content);
          }
          if (Array.isArray(parsedJson.improvements) && parsedJson.improvements.length > 0) {
            improvements = parsedJson.improvements;
          }
          if (Array.isArray(parsedJson.examples) && parsedJson.examples.length > 0) {
            examples = parsedJson.examples;
          }
        } catch (parseErr) {
          // Keep original
        }
      }
      
      let finalImprovedContent = improvedContent;
      let finalImprovements = improvements.filter((imp: any) => 
        imp && imp.type && imp.description && imp.before && imp.after
      );
      let finalExamples = examples.filter((ex: any) => typeof ex === 'string' && ex.trim().length > 0);

      if (locale !== 'en') {
        setIsImproving(true);
        
        finalImprovedContent = await translateText(improvedContent, locale, 'en');
        
        finalImprovements = await Promise.all(
          finalImprovements.map(async (imp: any) => ({
            ...imp,
            description: await translateText(imp.description, locale, 'en'),
            before: await translateText(imp.before, locale, 'en'),
            after: await translateText(imp.after, locale, 'en')
          }))
        );
        
        finalExamples = await Promise.all(
          finalExamples.map((ex: string) => translateText(ex, locale, 'en'))
        );
        
        setIsImproving(false);
      }

      const improvedContentData = {
        sectionId: data.sectionId || activeSection,
        originalContent: data.originalContent || '',
        improvedContent: finalImprovedContent,
        improvements: finalImprovements,
        examples: finalExamples
      };
      
      setImprovedContent(prev => ({
        ...prev,
        [activeSection]: improvedContentData
      }));
      
      setOriginalImprovedContent(prev => ({
        ...prev,
        [activeSection]: improvedContentData
      }));

      setIsImproving(false);
    } catch (error) {
      alert('Failed to improve section. Please try again.');
      setIsImproving(false);
    }
  };

  const fetchTranslations = async (targetLocale: string) => {
    if (!sessionId || isTranslating) return;
    
    const previousLocale = localStorage.getItem('reportCurrentLocale') || 'en';
    const sourceLocale = previousLocale;
    
    if (sourceLocale === targetLocale) return;
    
    const itemsToTranslate: any[] = [];
    
    const sectionsToTranslate = originalSections.length > 0 ? originalSections : sections;
    sectionsToTranslate.forEach(section => {
      if (section.content && section.content.trim()) {
        itemsToTranslate.push({
          id: `section-${section.id}`,
          type: 'user',
          content: section.content,
          timestamp: new Date()
        });
      }
    });
    
    originalAnalyses.forEach((analysis, index) => {
      if (analysis.analysis && analysis.analysis.trim()) {
        itemsToTranslate.push({
          id: `analysis-${index}`,
          type: 'user',
          content: analysis.analysis,
          timestamp: new Date()
        });
      }
    });
    
    if (originalExpertAnalysis?.expertAnalysis) {
      const ea = originalExpertAnalysis.expertAnalysis;
      if (ea.overallAssessment) {
        itemsToTranslate.push({
          id: 'expert-overall',
          type: 'user',
          content: ea.overallAssessment,
          timestamp: new Date()
        });
      }
      if (Array.isArray(ea.strengths)) {
        ea.strengths.forEach((strength: string, idx: number) => {
          itemsToTranslate.push({
            id: `expert-strength-${idx}`,
            type: 'user',
            content: strength,
            timestamp: new Date()
          });
        });
      }
      if (Array.isArray(ea.weaknesses)) {
        ea.weaknesses.forEach((weakness: string, idx: number) => {
          itemsToTranslate.push({
            id: `expert-weakness-${idx}`,
            type: 'user',
            content: weakness,
            timestamp: new Date()
          });
        });
      }
      if (ea.comparisonWithPeers) {
        itemsToTranslate.push({
          id: 'expert-comparison',
          type: 'user',
          content: ea.comparisonWithPeers,
          timestamp: new Date()
        });
      }
      if (Array.isArray(originalExpertAnalysis.improvementSuggestions)) {
        originalExpertAnalysis.improvementSuggestions.forEach((suggestion: any, idx: number) => {
          if (suggestion.suggestion) {
            itemsToTranslate.push({
              id: `suggestion-${idx}`,
              type: 'user',
              content: suggestion.suggestion,
              timestamp: new Date()
            });
          }
          if (suggestion.example) {
            itemsToTranslate.push({
              id: `suggestion-example-${idx}`,
              type: 'user',
              content: suggestion.example,
              timestamp: new Date()
            });
          }
        });
      }
    }
    
    Object.entries(originalImprovedContent).forEach(([sectionId, content]) => {
      if (content.improvedContent) {
        itemsToTranslate.push({
          id: `improved-${sectionId}`,
          type: 'user',
          content: content.improvedContent,
          timestamp: new Date()
        });
      }
      if (Array.isArray(content.improvements)) {
        content.improvements.forEach((imp: any, idx: number) => {
          if (imp.description) {
            itemsToTranslate.push({
              id: `improvement-desc-${sectionId}-${idx}`,
              type: 'user',
              content: imp.description,
              timestamp: new Date()
            });
          }
          if (imp.before) {
            itemsToTranslate.push({
              id: `improvement-before-${sectionId}-${idx}`,
              type: 'user',
              content: imp.before,
              timestamp: new Date()
            });
          }
          if (imp.after) {
            itemsToTranslate.push({
              id: `improvement-after-${sectionId}-${idx}`,
              type: 'user',
              content: imp.after,
              timestamp: new Date()
            });
          }
        });
      }
      if (Array.isArray(content.examples)) {
        content.examples.forEach((ex: string, idx: number) => {
          itemsToTranslate.push({
            id: `improvement-example-${sectionId}-${idx}`,
            type: 'user',
            content: ex,
            timestamp: new Date()
          });
        });
      }
    });
    
    if (itemsToTranslate.length === 0) return;
    
    setIsTranslating(true);
    setTranslationProgress(10);
    localStorage.setItem('reportCurrentLocale', targetLocale);
    localStorage.setItem('isTranslating', 'true');
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/translate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: itemsToTranslate,
          sourceLocale,
          targetLocale
        })
      });
      
      if (!response.ok) {
        throw new Error(`Translation failed: ${response.status}`);
      }
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Cannot read response stream');
      
      const decoder = new TextDecoder();
      let textBuffer = '';
      const translatedItems: Record<string, string> = {};
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });
        const completeMessages = textBuffer.split('\n\n');
        textBuffer = completeMessages.pop() || '';
        
        for (const messageText of completeMessages) {
          if (!messageText.trim()) continue;
          
          const eventLine = messageText.match(/^event: (.+)$/m);
          const dataLine = messageText.match(/^data: (.+)$/m);
          if (!eventLine || !dataLine) continue;
          
          const eventType = eventLine[1];
          const eventData = JSON.parse(dataLine[1]);
          
          if (eventType === 'token') {
            const index = eventData.index;
            if (itemsToTranslate[index]) {
              translatedItems[itemsToTranslate[index].id] = eventData.accumulated;
            }
          } else if (eventType === 'message') {
            const index = eventData.index;
            if (itemsToTranslate[index] && eventData.message?.content) {
              translatedItems[itemsToTranslate[index].id] = eventData.message.content;
            }
            setTranslationProgress(Math.round(((index + 1) / itemsToTranslate.length) * 100));
          } else if (eventType === 'complete') {
            setTranslationProgress(100);
            if (eventData.messages) {
              eventData.messages.forEach((msg: any, idx: number) => {
                if (itemsToTranslate[idx]) {
                  translatedItems[itemsToTranslate[idx].id] = msg.content;
                }
              });
            }
          } else if (eventType === 'error') {
            console.error('Translation error:', eventData.message);
          }
        }
      }
      
      const updatedSections = sections.map(section => {
        const translatedId = `section-${section.id}`;
        if (translatedItems[translatedId]) {
          return { ...section, content: translatedItems[translatedId] };
        }
        return section;
      });
      setSections(updatedSections);
      
      setAnalyses(prev => prev.map((analysis, index) => {
        const translatedId = `analysis-${index}`;
        if (translatedItems[translatedId]) {
          return { ...analysis, analysis: translatedItems[translatedId] };
        }
        return analysis;
      }));
      
      if (originalExpertAnalysis?.expertAnalysis) {
        const ea = originalExpertAnalysis.expertAnalysis;
        const updatedEA = { ...originalExpertAnalysis };
        
        if (translatedItems['expert-overall']) {
          updatedEA.expertAnalysis.overallAssessment = translatedItems['expert-overall'];
        }
        if (translatedItems['expert-comparison']) {
          updatedEA.expertAnalysis.comparisonWithPeers = translatedItems['expert-comparison'];
        }
        if (Array.isArray(ea.strengths)) {
          updatedEA.expertAnalysis.strengths = ea.strengths.map((_: string, idx: number) => 
            translatedItems[`expert-strength-${idx}`] || ea.strengths[idx]
          );
        }
        if (Array.isArray(ea.weaknesses)) {
          updatedEA.expertAnalysis.weaknesses = ea.weaknesses.map((_: string, idx: number) => 
            translatedItems[`expert-weakness-${idx}`] || ea.weaknesses[idx]
          );
        }
        if (Array.isArray(originalExpertAnalysis.improvementSuggestions)) {
          updatedEA.improvementSuggestions = originalExpertAnalysis.improvementSuggestions.map((suggestion: any, idx: number) => ({
            ...suggestion,
            suggestion: translatedItems[`suggestion-${idx}`] || suggestion.suggestion,
            example: translatedItems[`suggestion-example-${idx}`] || suggestion.example
          }));
        }
        
        setExpertAnalysis(updatedEA);
      }
      
      setImprovedContent(prev => {
        const updated = { ...prev };
        Object.entries(originalImprovedContent).forEach(([sectionId, content]) => {
          const improvedId = `improved-${sectionId}`;
          if (translatedItems[improvedId]) {
            updated[sectionId] = {
              ...content,
              improvedContent: translatedItems[improvedId]
            };
          }
          
          if (Array.isArray(content.improvements)) {
            updated[sectionId] = {
              ...(updated[sectionId] || content),
              improvements: content.improvements.map((imp: any, idx: number) => ({
                ...imp,
                description: translatedItems[`improvement-desc-${sectionId}-${idx}`] || imp.description,
                before: translatedItems[`improvement-before-${sectionId}-${idx}`] || imp.before,
                after: translatedItems[`improvement-after-${sectionId}-${idx}`] || imp.after
              }))
            };
          }
          
          if (Array.isArray(content.examples)) {
            updated[sectionId] = {
              ...(updated[sectionId] || content),
              examples: content.examples.map((ex: string, idx: number) => 
                translatedItems[`improvement-example-${sectionId}-${idx}`] || ex
              )
            };
          }
        });
        return updated;
      });
      
    } catch (err) {
      console.error('Error translating content:', err);
    } finally {
      setIsTranslating(false);
      setTranslationProgress(0);
      localStorage.setItem('isTranslating', 'false');
      // Update the stored locale after translation completes
      localStorage.setItem('reportCurrentLocale', targetLocale);
    }
  };

  const restoreReportData = async (savedSessionId: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/reports/${savedSessionId}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        localStorage.removeItem('reportSessionId');
        return;
      }

      const result = await response.json();
      if (!result.success || !result.data) {
        localStorage.removeItem('reportSessionId');
        return;
      }

      const data = result.data;
      setSessionId(savedSessionId);
      
      const analysesData = data.analyses || [];
      setAnalyses(analysesData);
      setOriginalAnalyses(analysesData);

      setDocumentMetadata({
        companyName: data.metadata?.company || 'Unknown',
        industry: data.metadata?.documentType || 'Unknown',
        reportYear: data.metadata?.year?.toString() || new Date().getFullYear().toString(),
        companySize: 'Unknown',
        riskCount: 0,
        positiveSignals: 0,
        sentimentScore: 0,
        complexityScore: 0
      });

      const sectionContent: Record<string, string> = {};
      (data.chunks || []).forEach((chunk: any) => {
        const sectionId = SECTION_TYPE_MAP[chunk.sectionType] || 'executive-summary';
        sectionContent[sectionId] = (sectionContent[sectionId] || '') + chunk.text + '\n\n';
      });
      
      let updatedSections = sections.map(section => ({
        ...section,
        content: sectionContent[section.id] || section.content
      }));

      if (locale !== 'en') {
        const translatedSections = await translateSectionsToEnglish(updatedSections, locale);
        updatedSections = translatedSections;
      }
      
      setSections(updatedSections);
      setOriginalSections(updatedSections);
      
      // Store the locale of the restored data (always English from cache)
      localStorage.setItem('reportCurrentLocale', 'en');

      if (data.expertAnalysis) {
        setExpertAnalysis(data.expertAnalysis);
        setOriginalExpertAnalysis(data.expertAnalysis);
      }

      let totalRiskCount = 0;
      let totalSentimentScore = 0;
      let totalComplexityScore = 0;
      let analysisCount = 0;

      if (analysesData.length > 0) {
        analysesData.forEach((analysis: any) => {
          try {
            const parsed = parseAnalysis(analysis.analysis);
            if (parsed) {
              if (parsed.riskFactors?.length) totalRiskCount += parsed.riskFactors.length;
              if (parsed.sentimentScore != null) {
                totalSentimentScore += Number(parsed.sentimentScore);
                analysisCount++;
              }
              if (parsed.complexityScore != null) {
                totalComplexityScore += Number(parsed.complexityScore);
              }
            }
          } catch (e) {
            // Skip invalid
          }
        });
      }

      const avgSentimentScore = analysisCount > 0 ? Math.round(totalSentimentScore / analysisCount) : 0;
      const avgComplexityScore = analysisCount > 0 ? Math.round(totalComplexityScore / analysisCount) : 0;
      const positiveSignals = avgSentimentScore > 0 ? Math.max(1, Math.round(avgSentimentScore / 10)) : 0;

      setDocumentMetadata(prev => prev ? {
        ...prev,
        riskCount: totalRiskCount,
        sentimentScore: avgSentimentScore,
        complexityScore: avgComplexityScore,
        positiveSignals
      } : null);
    } catch (error) {
      console.error('Error restoring report data:', error);
      localStorage.removeItem('reportSessionId');
      }
    };

  const clearReportData = () => {
    localStorage.removeItem('reportSessionId');
    localStorage.removeItem('reportCurrentLocale');
    localStorage.removeItem('isTranslating');
    setSessionId(null);
    setSections(SECTION_LIST.map(s => ({ ...s, content: '' })));
    setAnalyses([]);
    setExpertAnalysis(null);
    setImprovedContent({});
    setOriginalSections([]);
    setOriginalAnalyses([]);
    setOriginalExpertAnalysis(null);
    setOriginalImprovedContent({});
    setDocumentMetadata(null);
    setActiveView('insights');
    setActiveSection('executive-summary');
  };

  const handleRefresh = () => {
    clearReportData();
    window.location.reload();
  };
  
  useEffect(() => {
    let isMounted = true;
    let translationTimeout: NodeJS.Timeout | null = null;
    
    const initializeData = async () => {
      const savedSessionId = localStorage.getItem('reportSessionId');
      const currentSessionId = sessionId || savedSessionId;
      
      if (savedSessionId && !sessionId) {
        // Restore data from cache
        await restoreReportData(savedSessionId);
        
        // After restoring data, check if translation is needed
        // Wait for state to update, then check and translate
        if (isMounted) {
          translationTimeout = setTimeout(() => {
            if (isMounted) {
              const storedLocale = localStorage.getItem('reportCurrentLocale') || 'en';
              if (storedLocale !== locale) {
                // Use a small delay to ensure state is updated
                setTimeout(() => {
                  if (isMounted) {
                    fetchTranslations(locale);
                  }
                }, 300);
              }
            }
          }, 600);
        }
      } else if (currentSessionId) {
        // Data already loaded, check if translation is needed
        const storedLocale = localStorage.getItem('reportCurrentLocale') || 'en';
        if (storedLocale !== locale) {
          translationTimeout = setTimeout(() => {
            if (isMounted) {
              fetchTranslations(locale);
            }
          }, 300);
        }
      }
    };

    initializeData();

    const handleBeforeUnload = () => {
      clearReportData();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      isMounted = false;
      if (translationTimeout) {
        clearTimeout(translationTimeout);
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Don't clear data on unmount - only on beforeunload
    };
  }, [locale, sessionId]);

  useEffect(() => {
    if (!sessionId || isTranslating) return;
    
    const previousLocale = localStorage.getItem('reportCurrentLocale') || 'en';
    if (previousLocale === locale) return;
    
    // Only trigger translation if we have data and locale actually changed
    if (originalSections.length > 0 || originalAnalyses.length > 0 || originalExpertAnalysis || Object.keys(originalImprovedContent).length > 0) {
      const timeoutId = setTimeout(() => fetchTranslations(locale), 300);
      return () => clearTimeout(timeoutId);
    }
  }, [locale, sessionId, originalSections.length, originalAnalyses.length, originalExpertAnalysis, Object.keys(originalImprovedContent).length]);

  const renderBenchmarkMetric = (metric: any, label: string, showProgress = false) => {
    if (!metric) return null;
    const badge = getStatusBadge(metric.status);
    
    return (
      <div className="border-b border-gray-100 pb-3 last:border-b-0">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-900">{label}</span>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${badge.class}`}>
            {badge.text}
          </span>
            </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
            <span className="text-gray-600">Current: </span>
            <span className="text-gray-900 font-medium capitalize">
              {typeof metric.current === 'string' ? metric.current : metric.current}
            </span>
            </div>
            <div>
            <span className="text-gray-600">Industry Avg: </span>
            <span className="text-gray-900 font-medium">{metric.industryAvg}</span>
          </div>
        </div>
        {showProgress && typeof metric.current === 'number' && (
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className={`h-2 rounded-full ${
                metric.status === 'above' ? 'bg-green-500' :
                metric.status === 'below' ? 'bg-red-500' : 'bg-yellow-500'
              }`}
              style={{ width: `${Math.min(100, (metric.current / metric.industryAvg) * 100)}%` }}
              />
            </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen w-full bg-gray-50">
      <div className={`w-1/4 bg-gradient-to-b from-white to-gray-50 border-r border-gray-200 p-6 overflow-y-auto transition-all duration-300 ${isTranslating ? 'blur-md pointer-events-none opacity-75' : ''}`}>
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Document Context</h2>
          <div className="flex items-center gap-3">
            <Link 
              href={isTranslating ? '#' : `/${locale}`}
              className={`p-2 rounded-lg transition-colors group ${isTranslating ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'hover:bg-gray-100'}`}
              title="Home"
              onClick={(e) => {
                if (isTranslating) {
                  e.preventDefault();
                }
              }}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-6 w-6 text-gray-600 group-hover:text-gray-900 transition-colors" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" 
                />
              </svg>
            </Link>
            <AuthComponent />
            </div>
          </div>
        
        {isTranslating && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium text-blue-900">Translating content...</span>
                </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(0, Math.min(100, translationProgress))}%` }}
              />
                </div>
                </div>
        )}
        
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-3">Upload Report</label>
          <div className="relative">
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              disabled={!session?.user || isTranslating}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && session?.user && !isTranslating) handleFileUpload(file);
              }}
              className="block w-full text-sm text-gray-600 file:mr-4 file:py-3 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:transition-colors file:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            />
                </div>
          {!session?.user && (
            <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Please log in to upload files
            </p>
          )}
              </div>

        <div className={`mb-6 ${isTranslating ? 'pointer-events-none opacity-50' : ''}`}>
          <LanguageSwitcher disabled={isTranslating} />
            </div>

        <div className="mb-6">
          <button
            onClick={handleRefresh}
            disabled={isTranslating}
            className="w-full px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            title="Refresh"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-5 w-5" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
              />
            </svg>
            Refresh
          </button>
          </div>
      </div>

      <div className={`w-2/4 bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ${isTranslating ? 'blur-md pointer-events-none opacity-75' : ''}`}>
        {isLoadingReport ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600 text-lg font-medium">Processing report...</p>
              <p className="text-gray-500 text-sm mt-2">Extracting text, analyzing sections, and generating insights</p>
            </div>
          </div>
        ) : (
          <>
        <div className="border-b border-gray-200 flex overflow-x-auto">
              {SECTION_LIST.map((section) => (
            <button
              key={section.id}
                  onClick={() => !isTranslating && setActiveSection(section.id)}
                  disabled={isTranslating}
              className={`px-6 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
                    isTranslating
                      ? 'opacity-50 cursor-not-allowed'
                      : 'cursor-pointer'
                  } ${
                activeSection === section.id
                      ? 'border-blue-700 text-blue-700 bg-blue-50 font-semibold'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {section.title}
            </button>
          ))}
        </div>

        <div className="p-4 border-b border-gray-200 flex gap-2 flex-wrap">
          <button
            onClick={handleAIImprove}
                disabled={!sessionId || isImproving || isTranslating}
                className={`px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors ${
                  !sessionId || isImproving || isTranslating
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800 cursor-pointer'
                }`}
              >
                {isImproving ? '⏳ Improving...' : '✨ AI Improve'}
          </button>
          <button
            onClick={handleAnalyze}
                disabled={!sessionId || isLoadingAnalysis || isTranslating}
                className={`px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors ${
                  !sessionId || isLoadingAnalysis || isTranslating
                    ? 'bg-gray-400 cursor-not-allowed'
                    : activeView === 'expert' && expertAnalysis
                      ? 'bg-green-800 text-white shadow-md font-semibold'
                      : 'bg-green-600 hover:bg-green-700 active:bg-green-800 cursor-pointer'
                }`}
              >
                {isLoadingAnalysis ? '⏳ Analyzing...' : '🔍 Expert Analysis'}
          </button>
          <button
                onClick={() => !isTranslating && setActiveView('insights')}
                disabled={!sessionId || isTranslating}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !sessionId || isTranslating
                    ? 'bg-gray-400 cursor-not-allowed'
                    : activeView === 'insights'
                      ? 'bg-purple-800 text-white shadow-md cursor-pointer'
                      : 'bg-purple-600 text-white hover:bg-purple-700 active:bg-purple-800 cursor-pointer'
                }`}
              >
                💡 AI Insights
          </button>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          <textarea
            value={currentSection.content}
            onChange={(e) => {
                  if (!isTranslating) {
                    setSections(prev => prev.map(s => 
                      s.id === activeSection ? { ...s, content: e.target.value } : s
                    ));
                  }
                }}
                disabled={isTranslating}
            placeholder={`Start writing ${currentSection.title.toLowerCase()}...`}
                className="w-full h-full resize-none border-none outline-none text-gray-800 text-base leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontFamily: 'inherit' }}
          />
        </div>

        <div className="p-4 border-t border-gray-200 text-sm text-gray-500">
          {currentSection.content.length} characters
        </div>
          </>
        )}
      </div>

      <div className={`w-1/4 bg-gray-50 p-6 overflow-y-auto transition-all duration-300 ${isTranslating ? 'blur-md pointer-events-none opacity-75' : ''}`}>
        <h2 className="text-xl font-bold mb-4 text-gray-900">AI Insights</h2>

        {isLoadingAnalysis && (
          <div className="mb-6 text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mb-4"></div>
            <p className="text-sm text-gray-600">Analyzing report...</p>
          </div>
        )}

        {activeView === 'insights' && (() => {
          const analysisData = getCurrentAnalysis();
          
          if (!analysisData) {
            return (
              <div className="text-sm text-gray-500 text-center py-8">
                {analyses.length === 0 ? 'Upload and analyze a report to see insights' : 'No analysis available for this section'}
              </div>
            );
          }

          return (
            <>
              <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="text-xs text-gray-600 mb-2">Sentiment</div>
                  <div className="text-2xl font-bold mb-2 capitalize text-gray-900">
                    {analysisData.sentiment || 'N/A'}
            </div>
                  {analysisData.sentimentScore !== undefined && (
                    <>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                        <div
                          className={`h-2 rounded-full ${getSentimentColor(analysisData.sentiment)}`}
                          style={{ width: `${analysisData.sentimentScore}%` }}
                        />
          </div>
                      <div className="text-xs text-gray-600">{analysisData.sentimentScore}%</div>
                    </>
                  )}
        </div>

                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="text-xs text-gray-600 mb-2">Complexity</div>
                  <div className="text-2xl font-bold mb-2 text-gray-900">
                    {analysisData.complexityScore || 'N/A'}
            </div>
                  {analysisData.complexityScore !== undefined && (
                    <>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${analysisData.complexityScore}%` }}
                        />
            </div>
                      <div className="text-xs text-gray-600">Score</div>
                    </>
                  )}
            </div>

                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="text-xs text-gray-600 mb-2">Readability</div>
                  <div className="text-lg font-bold mb-2 text-gray-900">
                    {analysisData.readability || 'N/A'}
                  </div>
                  <div className="text-xs text-gray-600">Grade Level</div>
          </div>
        </div>

              {analysisData.keyMetrics?.length > 0 && (
        <div className="mb-6">
                  <h3 className="font-semibold mb-3 text-gray-900">Key Metrics</h3>
                  <div className="grid grid-cols-1 gap-2">
                    {analysisData.keyMetrics.map((metric: string, index: number) => (
                      <div
                        key={index}
                        className="bg-white p-3 rounded-lg border border-gray-200 flex items-center gap-2"
                      >
                        <span className="text-lg">📊</span>
                        <span className="text-sm text-gray-900 flex-1">{metric}</span>
              </div>
                    ))}
              </div>
            </div>
              )}

              <div className="mb-6">
                <h3 className="font-semibold mb-3 text-gray-900">Analysis Metrics</h3>
                <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
                  {analysisData.assertiveness && (
            <div>
                      <div className="flex justify-between text-sm mb-1 text-gray-900">
                <span>Assertiveness</span>
                        <span className="font-medium capitalize">{analysisData.assertiveness}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-purple-500 h-2 rounded-full"
                          style={{ width: `${stringToPercentage(analysisData.assertiveness)}%` }}
                        />
              </div>
            </div>
                  )}

                  {analysisData.riskTransparency && (
            <div>
                      <div className="flex justify-between text-sm mb-1 text-gray-900">
                <span>Risk Transparency</span>
                        <span className="font-medium capitalize">{analysisData.riskTransparency}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-orange-500 h-2 rounded-full"
                          style={{ width: `${stringToPercentage(analysisData.riskTransparency)}%` }}
                        />
              </div>
            </div>
                  )}
              </div>
            </div>

              {analysisData.riskFactors?.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold mb-3 text-gray-900">
                    Risk Factors ({analysisData.riskFactors.length})
                  </h3>
                  <div className="space-y-2">
                    {analysisData.riskFactors.map((risk: string, index: number) => (
                      <div
                        key={index}
                        className="bg-white p-3 rounded-lg border border-red-200 bg-red-50"
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-red-600 mt-0.5">⚠️</span>
                          <span className="text-sm text-gray-900 flex-1">{risk}</span>
          </div>
        </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          );
        })()}

        {activeView === 'expert' && expertAnalysis && (
          <div className="space-y-6">
            {expertAnalysis.expertAnalysis?.overallAssessment && (
          <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h3 className="font-semibold mb-3 text-gray-900 flex items-center gap-2">
                  <span className="text-xl">📋</span>
                  Overall Assessment
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {expertAnalysis.expertAnalysis.overallAssessment}
                </p>
            </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-lg border border-green-200">
                <h3 className="font-semibold mb-3 text-gray-900 flex items-center gap-2">
                  <span className="text-xl">✅</span>
                  Strengths ({expertAnalysis.expertAnalysis?.strengths?.length || 0})
                </h3>
                {expertAnalysis.expertAnalysis?.strengths?.length > 0 ? (
                  <div className="space-y-2">
                    {expertAnalysis.expertAnalysis.strengths.map((strength: string, index: number) => (
                      <div
                        key={index}
                        className="bg-green-50 p-3 rounded-lg border border-green-200"
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-green-600 mt-0.5">✓</span>
                          <span className="text-sm text-gray-900 flex-1">{strength}</span>
          </div>
        </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 text-center py-4">No strengths identified</div>
                )}
              </div>

              <div className="bg-white p-4 rounded-lg border border-red-200">
                <h3 className="font-semibold mb-3 text-gray-900 flex items-center gap-2">
                  <span className="text-xl">⚠️</span>
                  Weaknesses ({expertAnalysis.expertAnalysis?.weaknesses?.length || 0})
                </h3>
                {expertAnalysis.expertAnalysis?.weaknesses?.length > 0 ? (
                  <div className="space-y-2">
                    {expertAnalysis.expertAnalysis.weaknesses.map((weakness: string, index: number) => (
                      <div
                        key={index}
                        className="bg-red-50 p-3 rounded-lg border border-red-200"
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-red-600 mt-0.5">✗</span>
                          <span className="text-sm text-gray-900 flex-1">{weakness}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 text-center py-4">No weaknesses identified</div>
                )}
              </div>
            </div>

            {expertAnalysis.expertAnalysis?.comparisonWithPeers && (
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h3 className="font-semibold mb-3 text-gray-900 flex items-center gap-2">
                  <span className="text-xl">📊</span>
                  Comparison with Peers
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {expertAnalysis.expertAnalysis.comparisonWithPeers}
                </p>
              </div>
            )}

            {expertAnalysis.benchmarkComparison && (
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h3 className="font-semibold mb-4 text-gray-900 flex items-center gap-2">
                  <span className="text-xl">📈</span>
                  Benchmark Comparison
                </h3>
                <div className="space-y-4">
                  {renderBenchmarkMetric(expertAnalysis.benchmarkComparison.revenue, 'Revenue')}
                  {renderBenchmarkMetric(expertAnalysis.benchmarkComparison.riskTransparency, 'Risk Transparency')}
                  {renderBenchmarkMetric(expertAnalysis.benchmarkComparison.assertiveness, 'Assertiveness')}
                  {renderBenchmarkMetric(expertAnalysis.benchmarkComparison.complexityScore, 'Complexity Score', true)}
                  {renderBenchmarkMetric(expertAnalysis.benchmarkComparison.sentimentScore, 'Sentiment Score', true)}
                </div>
              </div>
            )}

            {expertAnalysis.improvementSuggestions?.length > 0 && (
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h3 className="font-semibold mb-4 text-gray-900 flex items-center gap-2">
                  <span className="text-xl">💡</span>
                  Improvement Suggestions ({expertAnalysis.improvementSuggestions.length})
                </h3>
                <div className="space-y-3">
                  {expertAnalysis.improvementSuggestions.map((suggestion: any, index: number) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border ${
                        suggestion.priority === 'high' ? 'bg-red-50 border-red-200' :
                        suggestion.priority === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                        'bg-blue-50 border-blue-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          suggestion.priority === 'high' ? 'bg-red-200 text-red-800' :
                          suggestion.priority === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                          'bg-blue-200 text-blue-800'
                        }`}>
                          {suggestion.priority?.toUpperCase() || 'LOW'}
                        </span>
                        <span className="text-sm font-semibold text-gray-900">{suggestion.area}</span>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{suggestion.suggestion}</p>
                      {suggestion.example && (
                        <div className="mt-2 p-2 bg-white rounded border border-gray-200">
                          <p className="text-xs text-gray-600 mb-1 font-medium">Example:</p>
                          <p className="text-xs text-gray-700 italic">{suggestion.example}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeView === 'expert' && !expertAnalysis && !isLoadingAnalysis && (
          <div className="text-sm text-gray-500 text-center py-8">
            Click "Expert Analysis" to get expert analysis and benchmark comparison
          </div>
        )}

        {improvedContent[activeSection] && (
          <div className="mt-6 bg-white p-4 rounded-lg border border-blue-200">
            <h3 className="font-semibold mb-3 text-gray-900 flex items-center gap-2">
              <span className="text-xl">✨</span>
              Improved Content
            </h3>
            
            <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {improvedContent[activeSection].improvedContent}
              </p>
            </div>
            
            {improvedContent[activeSection].improvements?.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold mb-2 text-gray-900">Improvements Made:</h4>
                <div className="space-y-2">
                  {improvedContent[activeSection].improvements.map((imp: any, idx: number) => (
                    <div key={idx} className="bg-blue-50 p-3 rounded border border-blue-200">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-200 text-blue-800 font-medium capitalize">
                          {imp.type}
                        </span>
                      </div>
                      <p className="text-xs text-gray-700 mb-1">{imp.description}</p>
                      {imp.before && imp.after && (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs text-gray-600">
                            <strong>Before:</strong> <span className="italic">{imp.before}</span>
                          </p>
                          <p className="text-xs text-gray-700">
                            <strong>After:</strong> <span className="italic">{imp.after}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {improvedContent[activeSection].examples?.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold mb-2 text-gray-900">Examples:</h4>
                <div className="space-y-1">
                  {improvedContent[activeSection].examples.map((ex: string, idx: number) => (
                    <div key={idx} className="text-xs text-gray-600 italic bg-gray-50 p-2 rounded border border-gray-200">
                      "{ex}"
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => {
                setSections(prev => prev.map(s => 
                  s.id === activeSection 
                    ? { ...s, content: improvedContent[activeSection].improvedContent }
                    : s
                ));
                setImprovedContent(prev => {
                  const newState = { ...prev };
                  delete newState[activeSection];
                  return newState;
                });
              }}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors"
            >
              ✓ Apply Improvement
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
