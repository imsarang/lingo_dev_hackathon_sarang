# Report Analyzer Implementation Guide

## Overview
This document outlines the step-by-step implementation plan for the Report Analyzer feature, including API endpoints, service architecture, and integration points.

---

## Architecture Overview

### Flow:
1. **Frontend** → Uploads PDF as FormData/Stream → **Backend**
2. **Backend** → Parse PDF directly from buffer (no S3)
3. **Backend** → Create chunks from PDF text
4. **Backend** → Feed chunks to LLM for analysis
5. **Backend** → Return analysis results to Frontend

### Key Principles:
- ✅ No S3 storage for reports (process directly from upload)
- ✅ History only for chat bot, NOT for report analyzer
- ✅ Use prompt service with enum for all LLM interactions
- ✅ Reuse existing services where possible

---

## Phase 1: File Upload and Document Parsing

### **API Endpoint: POST `/api/reports/upload`**

**Purpose:** Upload and parse a report document

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: File (PDF/DOCX/TXT)

**What it should do:**
1. Receive file from FormData/Stream
2. Parse file directly from buffer (use `fileProcessingService.parseFile()`)
3. Extract text from document
4. Parse metadata from filename (reuse `parseFilename()` from metadata.ts)
5. Detect sections (reuse `chunkingService.detectSections()`)
6. Create chunks from sections (reuse `chunkingService.sectionAwareChunking()`)
7. Extract initial metadata (company, year, industry, etc.)
8. Calculate initial metrics (risk count, sentiment, etc.) using LLM
9. Return structured response

**Response:**
```json
{
  "documentId": "uuid",
  "metadata": {
    "companyName": "string",
    "industry": "string",
    "reportYear": "string",
    "companySize": "string",
    "riskCount": 0,
    "positiveSignals": 0,
    "sentimentScore": 0,
    "complexityScore": 0
  },
  "sections": [
    {
      "id": "executive-summary",
      "title": "Executive Summary",
      "content": "extracted text..."
    },
    {
      "id": "risk-factors",
      "title": "Risk Factors",
      "content": "extracted text..."
    }
  ]
}
```

**Reusable Services:**
- ✅ `fileProcessingService` - parse files from buffer
- ✅ `chunkingService.detectSections()` - section detection
- ✅ `chunkingService.sectionAwareChunking()` - create chunks
- ✅ `parseFilename()` - metadata extraction
- ✅ `extractKeywords()` - keyword extraction
- ✅ `promptService` with `PromptTask.REPORT_SENTIMENT` - initial analysis

**New Services Needed:**
- `reportAnalysisService` - orchestrator for report analysis
- `metadataExtractionService` - extract company/industry from content (can use LLM)

---

## Phase 2: Section Analysis and Improvement

### **API Endpoint: POST `/api/reports/analyze`**

**Purpose:** Analyze a section for sentiment, risks, metrics

**Request:**
```json
{
  "sectionId": "risk-factors",
  "content": "section text content..."
}
```

**What it should do:**
1. Accept section content and sectionId
2. Use LLM with `PromptTask.REPORT_ANALYZE` prompt (reuse `retrieverService` or direct LLM call)
3. Extract: sentiment score, risk factors, key metrics, readability
4. Calculate: assertiveness, risk transparency, complexity
5. Return structured analysis

**Response:**
```json
{
  "sentiment": "positive",
  "sentimentScore": 75,
  "riskFactors": ["regulatory changes", "market volatility"],
  "keyMetrics": ["revenue growth", "profit margin"],
  "assertiveness": "medium",
  "riskTransparency": "high",
  "readability": "Grade 12",
  "complexityScore": 65
}
```

**Reusable Services:**
- ✅ `promptService.getPrompt(PromptTask.REPORT_ANALYZE, {...})`
- ✅ `retrieverService` - for LLM calls (or create direct LLM service)
- ✅ `extractKeywords()` - extract key terms

**New Services Needed:**
- `readabilityService` - calculate readability metrics (Flesch-Kincaid, etc.)

---

### **API Endpoint: POST `/api/reports/improve`**

**Purpose:** Improve section content with AI suggestions

**Request:**
```json
{
  "sectionId": "risk-factors",
  "content": "current section text..."
}
```

**What it should do:**
1. Accept section content and sectionId
2. Use LLM with `PromptTask.REPORT_IMPROVE` prompt
3. Generate improved version
4. Provide suggestions for clarity, professionalism, tone
5. Highlight areas needing improvement
6. Return improved content and suggestions

**Response:**
```json
{
  "improvedContent": "improved text...",
  "suggestions": [
    "Add more specific risk examples",
    "Improve clarity in paragraph 2"
  ],
  "changes": [
    {
      "type": "clarity",
      "original": "text...",
      "improved": "text...",
      "reason": "More professional phrasing"
    }
  ]
}
```

**Reusable Services:**
- ✅ `promptService.getPrompt(PromptTask.REPORT_IMPROVE, {...})`
- ✅ `retrieverService` - for LLM calls

**New Services Needed:**
- `contentImprovementService` - specialized improvement logic

---

## Phase 3: Keyword and Completion Features

### **API Endpoint: POST `/api/reports/keywords`**

**Purpose:** Suggest industry-specific keywords

**Request:**
```json
{
  "sectionId": "risk-factors",
  "content": "section text...",
  "selectedText": "optional selected text"
}
```

**What it should do:**
1. Accept section content, sectionId, and optional selectedText
2. Use LLM with `PromptTask.REPORT_KEYWORDS` prompt
3. Optionally query vector DB for similar sections (if we want to use existing documents)
4. Extract keywords from LLM response
5. Filter by industry/relevance
6. Return keyword suggestions

**Response:**
```json
{
  "keywords": [
    "macroeconomic volatility",
    "regulatory exposure",
    "supply chain disruptions"
  ],
  "industryKeywords": [
    "market risk",
    "operational risk"
  ]
}
```

**Reusable Services:**
- ✅ `promptService.getPrompt(PromptTask.REPORT_KEYWORDS, {...})`
- ✅ `retrieverService` - for LLM calls
- ✅ `vectorDBClient.query()` - optional: find similar sections from existing documents
- ✅ `extractKeywords()` - basic keyword extraction

**New Services Needed:**
- `keywordExtractionService` - advanced keyword extraction

---

### **API Endpoint: POST `/api/reports/complete`**

**Purpose:** Provide sentence/completion suggestions

**Request:**
```json
{
  "sectionId": "risk-factors",
  "partialText": "The company faces...",
  "context": "full section context..."
}
```

**What it should do:**
1. Accept partialText, sectionId, and context
2. Use LLM with `PromptTask.REPORT_COMPLETE` prompt
3. Generate 3-5 completion suggestions
4. Context-aware completions based on section type
5. Return completion suggestions

**Response:**
```json
{
  "completions": [
    "strong demand in emerging markets",
    "digital transformation initiatives",
    "operational cost efficiencies"
  ]
}
```

**Reusable Services:**
- ✅ `promptService.getPrompt(PromptTask.REPORT_COMPLETE, {...})`
- ✅ `retrieverService` - for LLM calls
- ✅ `chunkingService` - understand section context

**New Services Needed:**
- `completionService` - specialized completion logic

---

## Phase 4: Benchmarking

### **API Endpoint: POST `/api/reports/benchmark`**

**Purpose:** Compare report against industry standards

**Request:**
```json
{
  "sections": [
    {
      "id": "executive-summary",
      "title": "Executive Summary",
      "content": "text..."
    }
  ],
  "metadata": {
    "companyName": "Company X",
    "industry": "Technology",
    "reportYear": "2024"
  }
}
```

**What it should do:**
1. Accept full report sections and metadata
2. Use LLM with `PromptTask.REPORT_BENCHMARK` prompt
3. Optionally query vector DB for similar reports from top companies
4. Compare metrics: risk transparency, ESG coverage, financial depth, strategic clarity
5. Calculate industry averages (can be from LLM or static data)
6. Generate recommendations
7. Return benchmark comparison

**Response:**
```json
{
  "metrics": [
    {
      "metric": "Risk Transparency",
      "userReport": "62%",
      "industryAvg": "85%"
    },
    {
      "metric": "ESG Coverage",
      "userReport": "Low",
      "industryAvg": "High"
    }
  ],
  "recommendations": [
    "Increase risk factor disclosure",
    "Add more ESG metrics"
  ],
  "overallScore": 65
}
```

**Reusable Services:**
- ✅ `promptService.getPrompt(PromptTask.REPORT_BENCHMARK, {...})`
- ✅ `retrieverService` - for LLM calls
- ✅ `vectorDBClient.query()` - optional: find similar reports
- ✅ `extractKeywords()` - compare keyword usage

**New Services Needed:**
- `benchmarkService` - comparison logic
- `industryDataService` - industry averages (can be static JSON or from DB)

---

## Service Architecture

### New Services to Create:

1. **`fileProcessingService.ts`** ✅ (Already created)
   - Parse PDF/TXT from buffer
   - No S3 dependency

2. **`reportAnalysisService.ts`**
   - Main orchestrator for report analysis
   - Coordinates between file processing, chunking, and LLM calls

3. **`sentimentAnalysisService.ts`**
   - Sentiment scoring
   - Uses `PromptTask.REPORT_SENTIMENT`

4. **`readabilityService.ts`**
   - Readability metrics (Flesch-Kincaid, etc.)
   - Can be simple calculation or LLM-based

5. **`benchmarkService.ts`**
   - Benchmarking logic
   - Uses `PromptTask.REPORT_BENCHMARK`

6. **`completionService.ts`**
   - Text completion logic
   - Uses `PromptTask.REPORT_COMPLETE`

7. **`keywordExtractionService.ts`**
   - Advanced keyword extraction
   - Uses `PromptTask.REPORT_KEYWORDS`

8. **`metadataExtractionService.ts`**
   - Extract company/industry from content
   - Can use LLM or pattern matching

### Service Reuse Strategy:

- ✅ **`fileProcessingService`** → Parse files from buffer
- ✅ **`retrieverService`** → All LLM interactions (or create direct LLM service)
- ✅ **`vectorDBClient`** → Optional: document retrieval for benchmarking
- ✅ **`chunkingService`** → Section detection and chunking
- ✅ **`promptService`** → All prompts via enum
- ✅ **`translateLingoService`** → Ensure English output if needed
- ✅ **`cacheService`** → Cache analysis results (optional)
- ❌ **`s3Service`** → NOT used for reports
- ❌ **`sessionService`** → NOT used for reports (history only for chat)

---

## Implementation Priority

### **High Priority (MVP):**
1. ✅ File upload and parsing (`fileProcessingService`)
2. ✅ Section analysis (`/api/reports/analyze`)
3. ✅ Keyword suggestions (`/api/reports/keywords`)
4. ✅ Basic benchmarking (`/api/reports/benchmark`)

### **Medium Priority:**
5. AI improve (`/api/reports/improve`)
6. Sentence completions (`/api/reports/complete`)
7. Advanced analytics

### **Low Priority (Future):**
8. Versioning
9. Collaboration
10. Export features

---

## Database Considerations

### **Optional Tables/Collections:**
- `reports` - Store report metadata (if we want to save reports)
- `report_analyses` - Cache analysis results
- `benchmark_data` - Store industry benchmarks

**Note:** Since we're not storing reports in S3, we might not need to store them in DB either. Analysis can be done on-the-fly. However, caching analysis results might be useful.

---

## Frontend Integration

### **ReportAnalyzer Component Flow:**

1. **File Upload:**
   ```typescript
   const formData = new FormData();
   formData.append('file', file);
   const response = await fetch('/api/reports/upload', {
     method: 'POST',
     body: formData
   });
   ```

2. **Section Analysis:**
   ```typescript
   const response = await fetch('/api/reports/analyze', {
     method: 'POST',
     body: JSON.stringify({ sectionId, content })
   });
   ```

3. **Keyword Suggestions:**
   ```typescript
   const response = await fetch('/api/reports/keywords', {
     method: 'POST',
     body: JSON.stringify({ sectionId, content, selectedText })
   });
   ```

4. **AI Improve:**
   ```typescript
   const response = await fetch('/api/reports/improve', {
     method: 'POST',
     body: JSON.stringify({ sectionId, content })
   });
   ```

5. **Benchmark:**
   ```typescript
   const response = await fetch('/api/reports/benchmark', {
     method: 'POST',
     body: JSON.stringify({ sections, metadata })
   });
   ```

---

## Technical Notes

### **File Processing:**
- Use `multer` or `busboy` for handling FormData uploads
- Process files directly from buffer (no S3)
- Support PDF and TXT initially

### **LLM Integration:**
- Use `promptService` with appropriate `PromptTask` enum
- Can reuse `retrieverService` or create direct LLM service
- No conversation history for report analysis

### **Chunking:**
- Reuse existing `chunkingService.detectSections()`
- Reuse `chunkingService.sectionAwareChunking()`
- Feed chunks directly to LLM for analysis

### **Error Handling:**
- Validate file types
- Handle parsing errors gracefully
- Return meaningful error messages

---

## Next Steps

1. ✅ Create `fileProcessingService` (Done)
2. Create `reportAnalysisService` (orchestrator)
3. Create report controller with upload endpoint
4. Create report routes
5. Implement each API endpoint one by one
6. Test with frontend integration

---

## Questions/Considerations

1. **File Size Limits:** Should we limit file size for uploads?
2. **Caching:** Should we cache analysis results?
3. **Storage:** Do we want to store reports at all, or just process on-the-fly?
4. **Vector DB:** Should we use vector DB for benchmarking, or just LLM?
5. **Industry Data:** Where do industry averages come from? Static data or LLM?
