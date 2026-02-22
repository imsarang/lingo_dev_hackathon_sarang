'use client';

import { useState } from 'react';
import { useSession, getSession } from 'next-auth/react';
import { AuthComponent } from './AuthComponent';

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

const BASE_URL = 'http://localhost:3001';

export default function ReportAnalyzer() {
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

  const currentSection = sections.find(s => s.id === activeSection) || sections[0];

  const getAuthHeaders = async () => {
    const currentSession = await getSession();
    const idToken = (currentSession as any)?.idToken;
    return {
      'Content-Type': 'application/json',
      ...(idToken && { 'Authorization': `Bearer ${idToken}` })
    };
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
      
      const response = await fetch(`${BASE_URL}/api/reports/upload`, {
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
      setAnalyses(data.analyses || []);

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
      
      setSections(prev => prev.map(section => ({
        ...section,
        content: sectionContent[section.id] || section.content
      })));

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
      const response = await fetch(`${BASE_URL}/api/reports/analyze`, {
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

      setExpertAnalysis(result.data);
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
      const response = await fetch(`${BASE_URL}/api/reports/improve`, {
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
      
      setImprovedContent(prev => ({
        ...prev,
        [activeSection]: {
          sectionId: data.sectionId || activeSection,
          originalContent: data.originalContent || '',
          improvedContent: improvedContent,
          improvements: improvements.filter((imp: any) => 
            imp && imp.type && imp.description && imp.before && imp.after
          ),
          examples: examples.filter((ex: any) => typeof ex === 'string' && ex.trim().length > 0)
        }
      }));

      setIsImproving(false);
    } catch (error) {
      alert('Failed to improve section. Please try again.');
      setIsImproving(false);
    }
  };

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
      <div className="w-1/4 bg-white border-r border-gray-200 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Document Context</h2>
          <AuthComponent />
        </div>
        
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Upload Report</label>
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            disabled={!session?.user}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && session?.user) handleFileUpload(file);
            }}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {!session?.user && (
            <p className="text-xs text-red-600 mt-2">Please log in to upload files</p>
          )}
        </div>

        {documentMetadata ? (
          <div className="space-y-4 mb-6">
            <div>
              <label className="text-sm font-medium text-gray-900">Company Name</label>
              <input
                type="text"
                value={documentMetadata.companyName}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                readOnly
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-900">Industry</label>
              <input
                type="text"
                value={documentMetadata.industry}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                readOnly
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-900">Report Year</label>
              <input
                type="text"
                value={documentMetadata.reportYear}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                readOnly
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-900">Company Size</label>
              <input
                type="text"
                value={documentMetadata.companySize}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                readOnly
              />
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500 mb-6">Upload a report to see metadata</div>
        )}
      </div>

      <div className="w-2/4 bg-white border-r border-gray-200 flex flex-col">
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
                  onClick={() => setActiveSection(section.id)}
                  className={`px-6 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
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
                disabled={!sessionId || isImproving}
                className={`px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors ${
                  !sessionId || isImproving
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800 cursor-pointer'
                }`}
              >
                {isImproving ? '⏳ Improving...' : '✨ AI Improve'}
              </button>
              <button
                onClick={handleAnalyze}
                disabled={!sessionId || isLoadingAnalysis}
                className={`px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors ${
                  !sessionId || isLoadingAnalysis
                    ? 'bg-gray-400 cursor-not-allowed'
                    : activeView === 'expert' && expertAnalysis
                      ? 'bg-green-800 text-white shadow-md font-semibold'
                      : 'bg-green-600 hover:bg-green-700 active:bg-green-800 cursor-pointer'
                }`}
              >
                {isLoadingAnalysis ? '⏳ Analyzing...' : '🔍 Expert Analysis'}
              </button>
              <button
                onClick={() => setActiveView('insights')}
                disabled={!sessionId}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !sessionId
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
                  setSections(prev => prev.map(s => 
                    s.id === activeSection ? { ...s, content: e.target.value } : s
                  ));
                }}
                placeholder={`Start writing ${currentSection.title.toLowerCase()}...`}
                className="w-full h-full resize-none border-none outline-none text-gray-800 text-base leading-relaxed"
                style={{ fontFamily: 'inherit' }}
              />
            </div>

            <div className="p-4 border-t border-gray-200 text-sm text-gray-500">
              {currentSection.content.length} characters
            </div>
          </>
        )}
      </div>

      <div className="w-1/4 bg-gray-50 p-6 overflow-y-auto">
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
