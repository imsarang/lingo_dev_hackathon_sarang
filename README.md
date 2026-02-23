# AI Document Assistant

An intelligent document analysis platform that helps you interact with your documents through AI-powered chat and comprehensive report analysis.

## Features

- **AI Chat Interface**: Ask questions about your documents and get detailed answers using advanced RAG (Retrieval-Augmented Generation) technology
- **Report Analyzer**: Upload and analyze financial reports with AI-powered insights, keyword suggestions, and benchmarking
- **Multi-language Support**: Available in English, Spanish, French, German, and Hindi with automatic translation
- **Document Upload**: Support for PDF, DOCX, and TXT files
- **Real-time Translation**: Content automatically translates when switching languages

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: Express.js, TypeScript, Node.js
- **AI/ML**: OpenAI, HuggingFace, LangChain
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

## License

ISC
