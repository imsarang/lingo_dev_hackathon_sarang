# 💬 AI Chat Interface - Complete Guide

A modern, responsive chat interface for conversing with an AI assistant powered by RAG (Retrieval-Augmented Generation). Built with Next.js, React, and TypeScript.

## 🚀 Quick Start (3 Steps)

```bash
# 1. Start Backend (Terminal 1)
cd backend && npm run dev

# 2. Start Frontend (Terminal 2)
cd frontend && npm run dev

# 3. Open Browser
# Navigate to: http://localhost:3001/en/chat
```

That's it! You're ready to chat! 🎉

## 📚 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Installation](#-installation)
- [Usage](#-usage)
- [Configuration](#-configuration)
- [API Reference](#-api-reference)
- [Customization](#-customization)
- [Troubleshooting](#-troubleshooting)
- [FAQs](#-faqs)

## ✨ Features

### Core Functionality
- ✅ Real-time conversation with AI assistant
- ✅ RAG-powered responses based on your documents
- ✅ Message history within session
- ✅ Auto-scroll to latest messages
- ✅ Loading states and error handling

### User Experience
- ✅ Example questions for quick start
- ✅ Empty state with welcome message
- ✅ Timestamps on all messages
- ✅ Visual feedback (loading dots, animations)
- ✅ Input validation (no empty messages)

### Design
- ✅ Modern gradient UI (blue to purple)
- ✅ Dark mode support
- ✅ Fully responsive (mobile, tablet, desktop)
- ✅ Smooth animations and transitions
- ✅ Clean, minimal design

### Internationalization
- ✅ Support for 5+ languages
- ✅ Easy language switching
- ✅ Localized routes

## 🏗️ Architecture

### Frontend Stack
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **i18n**: next-intl
- **State**: React Hooks (useState, useRef, useEffect)

### Backend Stack
- **Framework**: Express.js
- **Language**: TypeScript
- **AI**: LangChain + OpenAI
- **Vector DB**: ChromaDB
- **CORS**: Enabled for local development

### File Structure
```
frontend/
├── components/
│   ├── ChatInterface.tsx       # Main chat component
│   └── ExampleQuestions.tsx    # Suggested questions
├── app/[locale]/
│   ├── page.tsx                # Homepage
│   └── chat/
│       └── page.tsx            # Chat page route
└── env.example                 # Environment template

backend/
├── src/
│   ├── controllers/
│   │   └── ingest.controller.ts   # API handlers
│   ├── services/
│   │   └── ingestion.service.ts   # RAG logic
│   └── server.ts                  # Express server + CORS
```

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Running backend server
- Documents ingested into vector database

### Setup

1. **Clone the repository** (if not already done)
```bash
git clone <your-repo-url>
cd lingo_dev
```

2. **Install Backend Dependencies**
```bash
cd backend
npm install
```

3. **Install Frontend Dependencies**
```bash
cd frontend
npm install
```

4. **Configure Environment** (Optional)
```bash
cd frontend
cp env.example .env.local
# Edit .env.local if needed
```

5. **Start ChromaDB** (if using Docker)
```bash
cd backend
npm run chromadb:start
```

6. **Start Development Servers**
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## 📖 Usage

### Accessing the Chat

Navigate to any of these URLs:
- English: `http://localhost:3001/en/chat`
- Spanish: `http://localhost:3001/es/chat`
- French: `http://localhost:3001/fr/chat`
- German: `http://localhost:3001/de/chat`
- Hindi: `http://localhost:3001/hi/chat`

### Sending Messages

1. **Using Example Questions**:
   - Click any example question button
   - The question populates the input field
   - Modify if needed, then send

2. **Typing Custom Questions**:
   - Type your question in the input field
   - Press Enter or click the send button (📤)
   - Wait for AI response

3. **Reading Responses**:
   - Bot messages appear on the left (white background)
   - Your messages appear on the right (gradient background)
   - Each message shows a timestamp

### Example Questions

Try these to get started:
- "What are the main topics covered in the documents?"
- "Can you summarize the key findings?"
- "What are the recommendations mentioned?"
- "Compare the different approaches discussed"

### Expected Response Time

- Typical: 2-5 seconds
- Complex queries: 5-10 seconds
- Depends on: Document size, query complexity, API response time

## ⚙️ Configuration

### Environment Variables

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

**Note**: This is optional. Default is `http://localhost:3000`.

### Backend Configuration

Ensure `backend/.env` contains:
```env
OPENAI_API_KEY=your_openai_api_key
# ... other ChromaDB and AWS configs
```

### CORS Configuration

Already configured in `backend/src/server.ts`:
```typescript
app.use(cors({
    origin: ['http://localhost:3001', 'http://localhost:3000'],
    credentials: true
}))
```

To add more origins:
```typescript
origin: ['http://localhost:3001', 'http://localhost:3000', 'https://yourdomain.com'],
```

### Customizing Example Questions

Edit `frontend/components/ExampleQuestions.tsx`:
```typescript
const EXAMPLE_QUESTIONS = [
  "Your custom question 1?",
  "Your custom question 2?",
  "Your custom question 3?",
  "Your custom question 4?",
];
```

## 🔌 API Reference

### RAG Endpoint

**Endpoint**: `POST /api/ingest/rag`

**Request**:
```json
{
  "question": "What are the main topics?"
}
```

**Response** (Success - 200):
```json
{
  "question": "What are the main topics?",
  "answer": "Based on the documents, the main topics include...",
  "contextCount": 3,
  "context": [
    "Context chunk 1...",
    "Context chunk 2...",
    "Context chunk 3..."
  ]
}
```

**Response** (Error - 400/500):
```json
{
  "message": "Error in RAG query",
  "error": "Detailed error message"
}
```

### Frontend API Call

Example from `ChatInterface.tsx`:
```typescript
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const response = await fetch(`${apiUrl}/api/ingest/rag`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ question: userMessage.content }),
});
const data = await response.json();
```

## 🎨 Customization

### Changing Colors

Edit gradient in `ChatInterface.tsx`:
```typescript
// Current: Blue to Purple
className="bg-gradient-to-r from-blue-600 to-purple-600"

// Change to: Green to Teal
className="bg-gradient-to-r from-green-600 to-teal-600"
```

### Modifying Layout

Adjust max width:
```typescript
// Current
className="max-w-4xl mx-auto"

// Wider
className="max-w-6xl mx-auto"

// Full width
className="w-full mx-auto"
```

### Adding Features

**Message Persistence**:
```typescript
// Save messages to localStorage
useEffect(() => {
  localStorage.setItem('chatMessages', JSON.stringify(messages));
}, [messages]);

// Load on mount
useEffect(() => {
  const saved = localStorage.getItem('chatMessages');
  if (saved) setMessages(JSON.parse(saved));
}, []);
```

**Clear Chat Button**:
```typescript
const clearChat = () => {
  setMessages([]);
  localStorage.removeItem('chatMessages');
};

// Add button in header
<button onClick={clearChat}>Clear Chat</button>
```

**Copy Message**:
```typescript
const copyMessage = (content: string) => {
  navigator.clipboard.writeText(content);
};

// Add button to each message
<button onClick={() => copyMessage(message.content)}>Copy</button>
```

## 🐛 Troubleshooting

### Issue: CORS Errors

**Symptoms**: Console shows CORS errors, no bot responses

**Solutions**:
1. Verify backend is running on port 3000
2. Check CORS configuration in `backend/src/server.ts`
3. Clear browser cache
4. Try different browser

### Issue: Backend Not Responding

**Symptoms**: "Failed to get response from bot" error

**Solutions**:
1. Check backend logs for errors
2. Verify ChromaDB is running: `docker ps`
3. Test API directly: `curl -X POST http://localhost:3000/api/ingest/rag -H "Content-Type: application/json" -d '{"question":"test"}'`
4. Check OpenAI API key is valid

### Issue: No Context/Empty Responses

**Symptoms**: Bot responds but says "no relevant information found"

**Solutions**:
1. Verify documents are ingested: `npm run inspect` (in backend)
2. Check vector database has data
3. Try broader questions
4. Ingest more documents

### Issue: Frontend Won't Start

**Symptoms**: Port already in use

**Solutions**:
1. Use different port: `npm run dev -- -p 3002`
2. Stop other Next.js instances: `killall node`
3. Check port usage: `lsof -i :3001`

### Issue: Dark Mode Not Working

**Symptoms**: Theme doesn't switch

**Solutions**:
1. Check system theme settings
2. Verify Tailwind config includes dark mode
3. Clear browser cache
4. Test with manual toggle (if implemented)

## ❓ FAQs

### Q: Can I use this with a different AI model?

**A**: Yes! Modify `backend/src/services/ingestion.service.ts` to use different LLM:
```typescript
const llm = new ChatAnthropic({ model: "claude-3-sonnet" }); // Anthropic
const llm = new ChatCohere({ model: "command" }); // Cohere
```

### Q: How do I deploy to production?

**A**: 
1. Build both applications:
   ```bash
   cd backend && npm run build
   cd frontend && npm run build
   ```
2. Deploy backend to server (EC2, Digital Ocean, etc.)
3. Deploy frontend to Vercel/Netlify
4. Update CORS and environment variables
5. Use HTTPS

### Q: Can I add authentication?

**A**: Yes! Consider:
- NextAuth.js for frontend
- JWT tokens for API
- Session management
- Protected routes

Example:
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token');
  if (!token) return NextResponse.redirect('/login');
}
```

### Q: How do I add message persistence?

**A**: Use localStorage (client-side) or database (server-side):

**Client-side**:
```typescript
localStorage.setItem('messages', JSON.stringify(messages));
```

**Server-side**:
- Add database (PostgreSQL, MongoDB)
- Store conversations by user ID
- Load history on mount

### Q: Can I customize the bot's personality?

**A**: Yes! Modify the system prompt in `backend/src/services/ingestion.service.ts`:
```typescript
const systemMessage = `You are a helpful assistant with a friendly personality...`;
```

### Q: How do I add file upload support?

**A**: 
1. Add file input to `ChatInterface.tsx`
2. Send file to backend endpoint
3. Process and ingest file
4. Return confirmation message

### Q: Is there a message limit?

**A**: Not currently, but you can add one:
```typescript
const MAX_MESSAGES = 100;
if (messages.length >= MAX_MESSAGES) {
  setMessages(prev => prev.slice(-MAX_MESSAGES));
}
```

### Q: Can I use this offline?

**A**: Not fully, but you can:
- Cache previous conversations
- Queue messages when offline
- Sync when back online

### Q: How do I add typing indicators?

**A**: Add state for bot typing:
```typescript
const [isTyping, setIsTyping] = useState(false);
// Show indicator when true
```

## 📚 Additional Documentation

- **Implementation Details**: `IMPLEMENTATION_SUMMARY.md`
- **Visual Guide**: `VISUAL_GUIDE.md`
- **Project Structure**: `PROJECT_STRUCTURE.md`
- **Quick Start**: `CHAT_QUICKSTART.md`
- **Component Details**: `frontend/CHAT_INTERFACE.md`

## 🤝 Contributing

To contribute:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

[Your License Here]

## 🙏 Acknowledgments

- Next.js team for the framework
- OpenAI for the LLM API
- ChromaDB for vector storage
- Tailwind CSS for styling

---

**Built with ❤️ for seamless AI conversations**

Need help? Check the troubleshooting section or open an issue!
