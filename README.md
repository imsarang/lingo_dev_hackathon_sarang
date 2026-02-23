# AI Document Assistant

An intelligent document analysis platform that helps you interact with your documents through AI-powered chat and comprehensive report analysis.

DEMO : https://www.youtube.com/watch?v=y5LR4aizQUg

deployed link : https://lingodevhackathonsarangdeploy.vercel.app/en
## Overview

AI Document Assistant is a comprehensive platform designed to break down language barriers in document analysis and interaction. Through its intelligent chatbot interface, users can engage in natural conversations about their documents, asking questions and receiving detailed answers powered by advanced RAG technology. The report analyzer feature provides deep insights, keyword suggestions, and benchmarking for financial documents. The platform can be expanded to support personal documents, tax documents, legal documents, property documents, and much more, enabling users to read and analyze content in their preferred language. By offering real-time translation and multi-language support, the system aims to completely remove language barriers, making document analysis accessible to users worldwide regardless of their native language.

## Features

### AI Chat Interface

The AI Chat Interface enables natural language conversations with your documents using advanced RAG (Retrieval-Augmented Generation) technology.

- **Intelligent Document Retrieval**: Uses vector similarity search to find the most relevant document chunks based on your question
- **Context-Aware Responses**: Generates accurate answers by combining retrieved document context with advanced language models
- **Conversation History**: Maintains context across multiple questions in a conversation session
- **Streaming Responses**: Provides real-time token-by-token responses for better user experience
- **Intent Classification**: Automatically detects question types (comparison, analysis, information) to optimize retrieval
- **Entity Extraction**: Identifies companies, keywords, and topics mentioned in questions for precise filtering
- **Multi-Document Support**: Can query across multiple uploaded documents simultaneously
- **Section-Aware Filtering**: Filters results by document sections (risk factors, financial performance, management discussion) based on question intent
- **Retry Logic**: Implements automatic retry with exponential backoff for reliable API interactions
- **Source Attribution**: Shows which document sections were used to generate each answer

### Report Analyzer

The Report Analyzer provides comprehensive AI-powered analysis of financial and business reports with actionable insights.

- **Document Processing**: Automatically parses PDF, DOCX, and TXT files and extracts structured content
- **Section Detection**: Intelligently identifies and segments different report sections (executive summary, risk factors, financial overview)
- **Chunk-Based Analysis**: Breaks documents into semantic chunks for granular analysis while maintaining context
- **Sentiment Analysis**: Evaluates overall sentiment and tone of the report using AI
- **Keyword Extraction**: Identifies and suggests important keywords and key metrics from the document
- **Expert-Level Analysis**: Provides comprehensive expert analysis including strengths, weaknesses, and peer comparisons
- **Benchmarking**: Compares report metrics against industry standards based on company size (large-cap, medium-cap, small-cap)
- **Section-Wise Improvements**: Offers targeted improvement suggestions for specific sections of the report
- **Metadata Extraction**: Automatically extracts company name, year, and other metadata from filenames
- **Caching System**: Stores analysis results for quick retrieval and section-wise improvements
- **Improvement Suggestions**: Provides before/after examples and specific recommendations for enhancing report quality
- **Risk Factor Analysis**: Identifies and categorizes risk factors mentioned in the document
- **Readability Assessment**: Evaluates document complexity and readability scores
- **Revenue Metrics**: Extracts and highlights revenue and financial performance metrics

### Multi-language Support

The platform breaks down language barriers by providing comprehensive multi-language support across all features.

- **Five Language Support**: Available in English, Spanish, French, German, and Hindi
- **Automatic Translation**: Content automatically translates when switching languages using Lingo.dev
- **Locale-Based Routing**: URL-based locale routing (e.g., `/en/chat`, `/es/chat`) for SEO-friendly multilingual URLs
- **Real-time UI Translation**: All user interface elements translate instantly when language is changed
- **Document Translation**: Chat responses and report analyses are translated to the user's preferred language
- **Language Switcher**: Easy-to-use dropdown component for switching languages on any page
- **Translation Workflow**: Automated CI/CD workflow that translates new content when English source files are updated
- **Context Preservation**: Maintains document context and meaning during translation
- **High-Quality Translation**: Provides context-aware translations through Lingo.dev's translation service
- **Persistent Language Preference**: Remembers user's language choice across sessions

### Document Upload & Processing

Robust document handling system that supports multiple file formats and processing workflows.

- **Multiple Format Support**: Accepts PDF, DOCX, and TXT file formats
- **File Validation**: Validates file types and sizes before processing
- **Asynchronous Processing**: Handles large documents without blocking the user interface
- **Chunking Strategy**: Implements intelligent text chunking that respects document structure and section boundaries
- **Metadata Preservation**: Maintains document metadata (company, year, section types) throughout processing
- **Vector Embedding**: Converts document chunks into vector embeddings for semantic search
- **Storage Integration**: Stores processed documents in AWS S3 for scalable file management
- **Session Management**: Creates unique sessions for each document upload to track analysis state
- **Error Handling**: Graceful error handling with informative messages for failed uploads
- **Progress Tracking**: Provides feedback during document processing and analysis

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: Express.js, TypeScript, Node.js
- **AI/ML**: HuggingFace, LangChain
- **Vector Database**: ChromaDB
- **Database**: PostgreSQL (Prisma ORM)
- **Caching**: Redis
- **Storage**: AWS S3
- **Authentication**: NextAuth.js
- **Translation**: Lingo.dev

## Project Structure

```
├── frontend/          # Next.js application
├── backend/          # Express.js API server
└── .github/          # CI/CD workflows
```

## Getting Started

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
npm install
npm run dev
```

## Deployment

- **Frontend**: Deployed on Vercel
- **Backend**: Deployed on EC2 with Docker
- **CI/CD**: Automated deployment via GitHub Actions

## Why This Tech Stack?

### Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS

- **Next.js 16**: Chosen for its App Router architecture which provides excellent support for internationalization with locale-based routing. Server-side rendering capabilities ensure fast initial page loads and SEO optimization. Built-in API routes simplify backend integration.
- **React 19**: Latest React version provides improved performance, better concurrent rendering, and enhanced developer experience with hooks and component patterns.
- **TypeScript**: Essential for type safety in a complex application with multiple integrations (AI APIs, databases, file processing). Prevents runtime errors and improves code maintainability.
- **Tailwind CSS**: Utility-first CSS framework enables rapid UI development and consistent design system. Perfect for building responsive, modern interfaces quickly.

### Backend: Express.js, TypeScript, Node.js

- **Express.js**: Lightweight and flexible web framework that handles routing, middleware, and API endpoints efficiently. Extensive ecosystem of middleware for file uploads, authentication, and error handling.
- **TypeScript**: Shared type safety between frontend and backend ensures consistency. Enables better IDE support and catches errors at compile time.
- **Node.js**: Single language (JavaScript/TypeScript) across the entire stack reduces context switching. Excellent for I/O-intensive operations like file processing and API calls. Large ecosystem of packages.

### AI/ML: HuggingFace, LangChain

- **HuggingFace**: Provides access to open-source language models (Meta-Llama-3-8B-Instruct) for RAG-based chat functionality. Cost-effective solution for conversational AI, sentiment analysis, and report analysis while maintaining quality.
- **LangChain**: Framework for building LLM applications simplifies prompt management, chain composition, and integration with vector databases. Provides abstractions for RAG workflows.

### Vector Database: ChromaDB

- **ChromaDB**: Lightweight, open-source vector database perfect for semantic search in RAG applications. Easy to deploy and integrate. Supports filtering and metadata queries essential for document retrieval. Docker-based deployment simplifies infrastructure management.

### Database: PostgreSQL (Prisma ORM)

- **PostgreSQL**: Robust relational database for storing user data, sessions, and document metadata. ACID compliance ensures data integrity. Excellent performance for complex queries and relationships.
- **Prisma ORM**: Type-safe database access layer that generates TypeScript types from schema. Reduces boilerplate code and prevents SQL injection. Excellent migration system and developer experience.

### Caching: Redis

- **Redis**: In-memory data store used for caching report analysis results, document sessions, and frequently accessed data. Dramatically reduces database load and improves response times. Essential for storing temporary analysis state during multi-step report processing.

### Storage: AWS S3

- **AWS S3**: Scalable object storage for uploaded documents. Handles large files efficiently and provides reliable storage with high availability. Cost-effective for storing and retrieving documents. Integrates seamlessly with other AWS services.

### Authentication: NextAuth.js

- **NextAuth.js**: Complete authentication solution for Next.js applications. Supports multiple providers (OAuth, email/password). Handles session management, CSRF protection, and secure cookie handling. Reduces security implementation complexity.

### Translation: Lingo.dev

- **Lingo.dev**: Specialized i18n platform that automates translation workflows. Integrates with CI/CD pipelines to automatically translate content when source files change. Provides high-quality, context-aware translations. Eliminates manual translation management overhead.

## License

ISC
