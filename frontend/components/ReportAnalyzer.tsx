'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

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

interface BenchmarkData {
  metric: string;
  userReport: string;
  industryAvg: string;
}

export default function ReportAnalyzer() {
  const t = useTranslations('chat');
  const [activeSection, setActiveSection] = useState<string>('executive-summary');
  const [selectedText, setSelectedText] = useState<string>('');
  const [documentMetadata, setDocumentMetadata] = useState<DocumentMetadata | null>(null);
  const [sections, setSections] = useState<ReportSection[]>([
    { id: 'executive-summary', title: 'Executive Summary', content: '' },
    { id: 'risk-factors', title: 'Risk Factors', content: '' },
    { id: 'financial-overview', title: 'Financial Overview', content: '' },
    { id: 'forward-looking', title: 'Forward Looking Statements', content: '' },
    { id: 'esg', title: 'ESG', content: '' },
  ]);

  // Section definitions
  const sectionList = [
    { id: 'executive-summary', title: 'Executive Summary' },
    { id: 'risk-factors', title: 'Risk Factors' },
    { id: 'financial-overview', title: 'Financial Overview' },
    { id: 'forward-looking', title: 'Forward Looking Statements' },
    { id: 'esg', title: 'ESG' },
  ];

  // Get current section content
  const currentSection = sections.find(s => s.id === activeSection) || sections[0];

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    // TODO: Backend call - POST /api/reports/upload
    // Send file to backend for parsing and analysis
    // Backend should return: metadata, extracted sections, initial analysis
    
    const formData = new FormData();
    formData.append('file', file);
    
    // Example backend call structure:
    // const response = await fetch('/api/reports/upload', {
    //   method: 'POST',
    //   body: formData
    // });
    // const data = await response.json();
    // setDocumentMetadata(data.metadata);
    // setSections(data.sections);
    
    console.log('File uploaded:', file.name);
  };

  // AI Improve section
  const handleAIImprove = async () => {
    // TODO: Backend call - POST /api/reports/improve
    // Send current section content to backend
    // Backend should return: improved version with suggestions
    
    // const response = await fetch('/api/reports/improve', {
    //   method: 'POST',
    //   body: JSON.stringify({
    //     sectionId: activeSection,
    //     content: currentSection.content
    //   })
    // });
    // const improved = await response.json();
    // Update section with improved content
    
    console.log('AI Improve clicked for:', activeSection);
  };

  // Analyze section
  const handleAnalyze = async () => {
    // TODO: Backend call - POST /api/reports/analyze
    // Send current section content for analysis
    // Backend should return: sentiment, risk factors, key metrics
    
    // const response = await fetch('/api/reports/analyze', {
    //   method: 'POST',
    //   body: JSON.stringify({
    //     sectionId: activeSection,
    //     content: currentSection.content
    //   })
    // });
    // const analysis = await response.json();
    // Update insights panel with analysis results
    
    console.log('Analyze clicked for:', activeSection);
  };

  // Get keyword suggestions
  const handleSuggestKeywords = async () => {
    // TODO: Backend call - POST /api/reports/keywords
    // Send current section and selected text
    // Backend should return: industry-specific keyword suggestions
    
    // const response = await fetch('/api/reports/keywords', {
    //   method: 'POST',
    //   body: JSON.stringify({
    //     sectionId: activeSection,
    //     content: currentSection.content,
    //     selectedText: selectedText
    //   })
    // });
    // const keywords = await response.json();
    // Display keywords in right panel
    
    console.log('Suggest Keywords clicked');
  };

  // Compare with top companies
  const handleBenchmark = async () => {
    // TODO: Backend call - POST /api/reports/benchmark
    // Send full report content
    // Backend should compare against top company reports
    // Return: benchmark metrics, comparisons, recommendations
    
    // const response = await fetch('/api/reports/benchmark', {
    //   method: 'POST',
    //   body: JSON.stringify({
    //     sections: sections,
    //     metadata: documentMetadata
    //   })
    // });
    // const benchmark = await response.json();
    // Display benchmark dashboard
    
    console.log('Benchmark clicked');
  };

  // Get sentence completions
  const handleGetCompletions = async (partialText: string) => {
    // TODO: Backend call - POST /api/reports/complete
    // Send partial sentence and context
    // Backend should return: completion suggestions
    
    // const response = await fetch('/api/reports/complete', {
    //   method: 'POST',
    //   body: JSON.stringify({
    //     sectionId: activeSection,
    //     partialText: partialText,
    //     context: currentSection.content
    //   })
    // });
    // const completions = await response.json();
    // Display completions in right panel
    
    console.log('Get completions for:', partialText);
  };

  // Update section content
  const updateSectionContent = (sectionId: string, content: string) => {
    setSections(prev => prev.map(s => 
      s.id === sectionId ? { ...s, content } : s
    ));
    
    // Auto-trigger insights when content changes
    if (content.length > 50) {
      handleGetCompletions(content.slice(-20)); // Get completions for last 20 chars
    }
  };

  return (
    <div className="flex h-screen w-full bg-gray-50">
      {/* Left Panel - Document Context */}
      <div className="w-1/4 bg-white border-r border-gray-200 p-6 overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Document Context</h2>
        
        {/* File Upload */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Upload Report</label>
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        {/* Metadata */}
        {documentMetadata ? (
          <div className="space-y-4 mb-6">
            <div>
              <label className="text-sm font-medium text-gray-700">Company Name</label>
              <input
                type="text"
                value={documentMetadata.companyName}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                readOnly
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Industry</label>
              <input
                type="text"
                value={documentMetadata.industry}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                readOnly
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Report Year</label>
              <input
                type="text"
                value={documentMetadata.reportYear}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                readOnly
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Company Size</label>
              <input
                type="text"
                value={documentMetadata.companySize}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                readOnly
              />
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500 mb-6">Upload a report to see metadata</div>
        )}

        {/* Highlights */}
        {documentMetadata && (
          <div className="space-y-3">
            <h3 className="font-semibold">Highlights</h3>
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-sm">
                <div className="flex justify-between mb-2">
                  <span>Risk Count:</span>
                  <span className="font-medium">{documentMetadata.riskCount}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span>Positive Signals:</span>
                  <span className="font-medium">{documentMetadata.positiveSignals}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span>Sentiment Score:</span>
                  <span className="font-medium">{documentMetadata.sentimentScore}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Complexity Score:</span>
                  <span className="font-medium">{documentMetadata.complexityScore}%</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Center Panel - Report Editor */}
      <div className="w-2/4 bg-white border-r border-gray-200 flex flex-col">
        {/* Section Tabs */}
        <div className="border-b border-gray-200 flex overflow-x-auto">
          {sectionList.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`px-6 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
                activeSection === section.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {section.title}
            </button>
          ))}
        </div>

        {/* AI Action Buttons */}
        <div className="p-4 border-b border-gray-200 flex gap-2 flex-wrap">
          <button
            onClick={handleAIImprove}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            ✨ AI Improve
          </button>
          <button
            onClick={handleAnalyze}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
          >
            🔍 Analyze
          </button>
          <button
            onClick={handleSuggestKeywords}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
          >
            💡 Suggest Keywords
          </button>
          <button
            onClick={handleBenchmark}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium"
          >
            📊 Compare to Top Companies
          </button>
        </div>

        {/* Rich Text Editor */}
        <div className="flex-1 p-6 overflow-y-auto">
          <textarea
            value={currentSection.content}
            onChange={(e) => {
              updateSectionContent(activeSection, e.target.value);
              setSelectedText(e.target.value.substring(e.target.selectionStart, e.target.selectionEnd));
            }}
            onSelect={(e) => {
              const target = e.target as HTMLTextAreaElement;
              setSelectedText(target.value.substring(target.selectionStart, target.selectionEnd));
            }}
            placeholder={`Start writing ${currentSection.title.toLowerCase()}...`}
            className="w-full h-full resize-none border-none outline-none text-gray-800 text-base leading-relaxed"
            style={{ fontFamily: 'inherit' }}
          />
        </div>

        {/* Word Count */}
        <div className="p-4 border-t border-gray-200 text-sm text-gray-500">
          {currentSection.content.length} characters
        </div>
      </div>

      {/* Right Panel - AI Insights */}
      <div className="w-1/4 bg-gray-50 p-6 overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">AI Insights</h2>

        {/* Keyword Recommendations */}
        <div className="mb-6">
          <h3 className="font-semibold mb-3">Keyword Recommendations</h3>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex flex-wrap gap-2">
              {/* TODO: Display keywords from backend response */}
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                macroeconomic volatility
              </span>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                regulatory exposure
              </span>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                supply chain disruptions
              </span>
            </div>
          </div>
        </div>

        {/* Sentence Completions */}
        <div className="mb-6">
          <h3 className="font-semibold mb-3">Sentence Completions</h3>
          <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-2">
            {/* TODO: Display completions from backend */}
            <div className="text-sm p-2 hover:bg-gray-50 rounded cursor-pointer">
              "strong demand in emerging markets"
            </div>
            <div className="text-sm p-2 hover:bg-gray-50 rounded cursor-pointer">
              "digital transformation initiatives"
            </div>
            <div className="text-sm p-2 hover:bg-gray-50 rounded cursor-pointer">
              "operational cost efficiencies"
            </div>
          </div>
        </div>

        {/* Tone & Professionalism Score */}
        <div className="mb-6">
          <h3 className="font-semibold mb-3">Tone & Professionalism</h3>
          <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-3">
            {/* TODO: Display scores from backend analysis */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Sentiment</span>
                <span className="font-medium">Positive</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: '75%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Assertiveness</span>
                <span className="font-medium">Medium</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '60%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Risk Transparency</span>
                <span className="font-medium">High</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-purple-500 h-2 rounded-full" style={{ width: '85%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Readability</span>
                <span className="font-medium">Grade 12</span>
              </div>
            </div>
          </div>
        </div>

        {/* Benchmark Dashboard (shown when benchmark is clicked) */}
        <div className="mb-6">
          <h3 className="font-semibold mb-3">Benchmark Comparison</h3>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Metric</th>
                    <th className="text-center py-2">Your Report</th>
                    <th className="text-center py-2">Industry Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {/* TODO: Display benchmark data from backend */}
                  <tr className="border-b">
                    <td className="py-2">Risk Transparency</td>
                    <td className="text-center py-2">62%</td>
                    <td className="text-center py-2">85%</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">ESG Coverage</td>
                    <td className="text-center py-2">Low</td>
                    <td className="text-center py-2">High</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">Strategic Clarity</td>
                    <td className="text-center py-2">Medium</td>
                    <td className="text-center py-2">High</td>
                  </tr>
                  <tr>
                    <td className="py-2">Financial Depth</td>
                    <td className="text-center py-2">Strong</td>
                    <td className="text-center py-2">Strong</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
