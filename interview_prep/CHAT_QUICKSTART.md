# Quick Start Guide - Chat Interface

## Prerequisites

- Node.js (v18 or higher)
- Backend server running
- Documents ingested into the vector database

## Setup Steps

### 1. Backend Setup

```bash
cd backend

# Install dependencies (if not already done)
npm install

# Start ChromaDB (if using Docker)
npm run chromadb:start

# Start the backend server
npm run dev
```

The backend will run on **http://localhost:3000**

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies (if not already done)
npm install

# Start the development server
npm run dev
```

The frontend will likely run on **http://localhost:3001** (since backend is on 3000)

### 3. Access the Chat Interface

Open your browser and navigate to:
```
http://localhost:3001/en/chat
```

Available language routes:
- English: `/en/chat`
- Spanish: `/es/chat`
- French: `/fr/chat`
- German: `/de/chat`
- Hindi: `/hi/chat`

## Usage

1. Type your question in the input field at the bottom
2. Press Enter or click the send button (paper plane icon)
3. Wait for the AI assistant to process your question
4. The response will appear as a bot message

## Features

✅ **Real-time Chat**: Instant messaging with the AI assistant  
✅ **RAG-powered**: Answers based on your ingested documents  
✅ **Multi-language**: Available in 5+ languages  
✅ **Dark Mode**: Automatic dark/light theme support  
✅ **Responsive**: Works on desktop, tablet, and mobile  
✅ **Loading States**: Visual feedback during processing  

## Troubleshooting

### Backend not responding
- Ensure backend is running on port 3000
- Check backend logs for errors
- Verify ChromaDB is running (if using)

### CORS errors
- The backend is configured to accept requests from localhost:3000 and localhost:3001
- Check browser console for specific CORS errors

### No answers from bot
- Ensure documents are ingested into the vector database
- Check backend logs for RAG processing errors
- Verify OpenAI API key is configured in backend/.env

### Frontend won't start
- Check if port 3001 is available
- Try running on a different port: `npm run dev -- -p 3002`
- Update NEXT_PUBLIC_API_URL in .env.local if needed

## Next Steps

- **Ingest Documents**: Use the ingestion API to add documents to the vector database
- **Customize UI**: Edit `frontend/components/ChatInterface.tsx` to match your brand
- **Add Features**: Extend the chat with file uploads, voice input, etc.
- **Deploy**: Build for production and deploy to your preferred platform

## API Details

The chat interface communicates with:

**Endpoint**: `POST /api/ingest/rag`

**Request**:
```json
{
  "question": "Your question here"
}
```

**Response**:
```json
{
  "question": "Your question",
  "answer": "AI-generated answer based on documents",
  "contextCount": 3,
  "context": ["relevant document chunks"]
}
```

## Documentation

- Chat Interface Details: `frontend/CHAT_INTERFACE.md`
- Backend Documentation: `backend/README.md`
- ChromaDB Guide: `backend/CHROMADB_ACCESS_GUIDE.md`

---

**Happy Chatting! 🚀**
