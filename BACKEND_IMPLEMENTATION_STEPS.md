# Backend Implementation Steps for Report Analyzer

## Overview
This document outlines the backend implementation steps for the Company Report Analyzer feature.

---

## 1. File Upload & Parsing Endpoint

### Endpoint: `POST /api/reports/upload`

**Purpose**: Accept uploaded report file, parse it, extract sections, and perform initial analysis.

**Implementation Steps**:

1. **File Handling**
   - Accept multipart/form-data with file
   - Support formats: PDF, DOCX, TXT
   - Use libraries:
     - PDF: `pdf-parse` or `pdfjs-dist`
     - DOCX: `mammoth` or `docx`
     - TXT: native Node.js

2. **Document Parsing**
   - Extract text content from file
   - Identify sections using:
     - Headers detection (regex patterns)
     - Section markers (Executive Summary, Risk Factors, etc.)
   - Split document into sections

3. **Metadata Extraction**
   - Extract company name (from headers/first page)
   - Extract report year (date patterns)
   - Determine industry (keyword matching or ML model)
   - Estimate company size (from financial data if available)

4. **Initial Analysis**
   - Count risk factors (keyword matching: "risk", "uncertainty", etc.)
   - Identify positive signals (growth keywords)
   - Calculate sentiment score (use sentiment analysis library)
   - Calculate complexity score (readability metrics: Flesch-Kincaid)

5. **Response Structure**:
```json
{
  "success": true,
  "metadata": {
    "companyName": "Example Corp",
    "industry": "Technology",
    "reportYear": "2024",
    "companySize": "Large",
    "riskCount": 15,
    "positiveSignals": 8,
    "sentimentScore": 72,
    "complexityScore": 65
  },
  "sections": [
    {
      "id": "executive-summary",
      "title": "Executive Summary",
      "content": "extracted content..."
    }
    // ... other sections
  ]
}
```

**Dependencies to install**:
```bash
npm install pdf-parse mammoth sentiment natural
```

---

## 2. AI Improve Section Endpoint

### Endpoint: `POST /api/reports/improve`

**Purpose**: Improve a section's content using AI (LLM).

**Implementation Steps**:

1. **Receive Section Data**
   - Section ID
   - Current content
   - Optional: improvement type (clarity, professionalism, conciseness)

2. **LLM Processing**
   - Use OpenAI API or similar
   - Prompt: "Improve this financial report section for clarity and professionalism: [content]"
   - Get improved version

3. **Response**:
```json
{
  "success": true,
  "improvedContent": "improved text...",
  "changes": [
    {
      "type": "clarity",
      "description": "Simplified complex sentence"
    }
  ]
}
```

**Dependencies**:
```bash
npm install openai
```

---

## 3. Analyze Section Endpoint

### Endpoint: `POST /api/reports/analyze`

**Purpose**: Analyze a section for sentiment, risk factors, and key metrics.

**Implementation Steps**:

1. **Text Analysis**
   - Sentiment analysis (positive/negative/neutral)
   - Risk factor extraction (keyword matching + context)
   - Key metrics extraction (numbers, percentages, financial terms)

2. **Response**:
```json
{
  "success": true,
  "analysis": {
    "sentiment": "positive",
    "sentimentScore": 75,
    "riskFactors": ["market volatility", "regulatory changes"],
    "keyMetrics": ["revenue growth: 15%", "profit margin: 22%"],
    "tone": {
      "assertiveness": "medium",
      "transparency": "high",
      "readability": "grade 12"
    }
  }
}
```

**Dependencies**:
```bash
npm install sentiment natural
```

---

## 4. Keyword Suggestions Endpoint

### Endpoint: `POST /api/reports/keywords`

**Purpose**: Suggest industry-specific keywords based on section and context.

**Implementation Steps**:

1. **Context Analysis**
   - Identify section type (risk, financial, ESG, etc.)
   - Analyze current content
   - Extract industry from metadata

2. **Keyword Generation**
   - Use predefined keyword lists per industry/section
   - Or use LLM to generate contextually relevant keywords
   - Filter by relevance

3. **Response**:
```json
{
  "success": true,
  "keywords": [
    {
      "term": "macroeconomic volatility",
      "category": "risk",
      "relevance": 0.9
    },
    {
      "term": "regulatory exposure",
      "category": "risk",
      "relevance": 0.85
    }
  ]
}
```

**Implementation Options**:
- **Simple**: Predefined keyword lists in JSON files
- **Advanced**: LLM-based generation

---

## 5. Sentence Completion Endpoint

### Endpoint: `POST /api/reports/complete`

**Purpose**: Provide sentence completion suggestions.

**Implementation Steps**:

1. **Context Understanding**
   - Get partial sentence
   - Get section context
   - Understand intent

2. **Completion Generation**
   - Use LLM (OpenAI completion API)
   - Generate 3-5 completion options
   - Filter for financial/professional tone

3. **Response**:
```json
{
  "success": true,
  "completions": [
    "strong demand in emerging markets",
    "digital transformation initiatives",
    "operational cost efficiencies"
  ]
}
```

**Dependencies**:
```bash
npm install openai
```

---

## 6. Benchmark Comparison Endpoint

### Endpoint: `POST /api/reports/benchmark`

**Purpose**: Compare user's report against top company reports.

**Implementation Steps**:

1. **Top Company Reports Database**
   - Store sample reports from:
     - Apple Inc.
     - Reliance Industries
     - Infosys
     - Other top companies
   - Pre-analyze these reports and store metrics

2. **User Report Analysis**
   - Analyze all sections
   - Calculate metrics:
     - Risk Transparency (% of risks clearly stated)
     - ESG Coverage (presence of ESG section, depth)
     - Strategic Clarity (executive summary quality)
     - Financial Depth (detail level in financial section)

3. **Comparison Logic**
   - Compare each metric against industry average
   - Generate recommendations

4. **Response**:
```json
{
  "success": true,
  "benchmark": {
    "metrics": [
      {
        "metric": "Risk Transparency",
        "userReport": "62%",
        "industryAvg": "85%",
        "recommendation": "Add more specific risk descriptions"
      },
      {
        "metric": "ESG Coverage",
        "userReport": "Low",
        "industryAvg": "High",
        "recommendation": "Expand ESG section with specific initiatives"
      }
    ],
    "overallScore": 68,
    "industryAvgScore": 82
  }
}
```

**Database Schema** (for storing top company reports):
```sql
CREATE TABLE top_company_reports (
  id SERIAL PRIMARY KEY,
  company_name VARCHAR(255),
  industry VARCHAR(100),
  report_year INT,
  risk_transparency DECIMAL(5,2),
  esg_coverage VARCHAR(50),
  strategic_clarity VARCHAR(50),
  financial_depth VARCHAR(50),
  report_content TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 7. Database Schema

### Reports Table
```sql
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  company_name VARCHAR(255),
  industry VARCHAR(100),
  report_year INT,
  file_name VARCHAR(255),
  file_path TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Report Sections Table
```sql
CREATE TABLE report_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES reports(id),
  section_id VARCHAR(50),
  title VARCHAR(255),
  content TEXT,
  analysis JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 8. File Structure

```
backend/
├── src/
│   ├── routes/
│   │   └── report.route.ts          # All report routes
│   ├── controllers/
│   │   └── report.controller.ts     # Request handlers
│   ├── services/
│   │   ├── report.service.ts         # Business logic
│   │   ├── parser.service.ts         # Document parsing
│   │   ├── analysis.service.ts      # Text analysis
│   │   └── benchmark.service.ts     # Benchmarking logic
│   ├── utils/
│   │   ├── fileParser.ts            # PDF/DOCX parsing
│   │   ├── textAnalyzer.ts          # Sentiment, complexity
│   │   └── keywordExtractor.ts      # Keyword extraction
│   └── data/
│       └── topReports.json          # Top company report data
```

---

## 9. Implementation Order

1. **Phase 1: Basic Upload & Parsing**
   - Implement file upload endpoint
   - Basic text extraction
   - Simple section detection

2. **Phase 2: Analysis Features**
   - Sentiment analysis
   - Keyword extraction
   - Tone analysis

3. **Phase 3: AI Features**
   - LLM integration for improvements
   - Sentence completions
   - Keyword suggestions

4. **Phase 4: Benchmarking**
   - Top company report database
   - Comparison logic
   - Recommendations

---

## 10. Environment Variables

```env
# LLM API (OpenAI or similar)
OPENAI_API_KEY=your_key_here

# File Storage
UPLOAD_DIR=./uploads/reports
MAX_FILE_SIZE=10485760  # 10MB

# Analysis Services
SENTIMENT_API_KEY=optional
```

---

## 11. Quick Start Implementation

### Step 1: Install Dependencies
```bash
npm install pdf-parse mammoth sentiment natural openai multer
npm install --save-dev @types/multer
```

### Step 2: Create Basic Route
```typescript
// backend/src/routes/report.route.ts
import express from 'express';
import multer from 'multer';
import { uploadReport, improveSection, analyzeSection, getKeywords, getCompletions, benchmark } from '../controllers/report.controller';

const router = express.Router();
const upload = multer({ dest: 'uploads/reports/' });

router.post('/upload', upload.single('file'), uploadReport);
router.post('/improve', improveSection);
router.post('/analyze', analyzeSection);
router.post('/keywords', getKeywords);
router.post('/complete', getCompletions);
router.post('/benchmark', benchmark);

export default router;
```

### Step 3: Register Route in server.ts
```typescript
import reportRoutes from './routes/report.route';
app.use('/api/reports', reportRoutes);
```

---

## 12. Testing

Test each endpoint with:
- Postman/Insomnia
- Sample PDF/DOCX files
- Mock data for benchmarking

---

## Notes

- Start simple: Use predefined keyword lists before LLM integration
- Cache top company report analyses to avoid re-computation
- Consider rate limiting for LLM API calls
- Store uploaded files securely (consider cloud storage for production)
