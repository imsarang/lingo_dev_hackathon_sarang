# Chat Interface

A simple yet effective chat interface for conversing with the AI assistant.

## Features

- 🎨 **Modern UI**: Clean, gradient-based design with dark mode support
- 💬 **Real-time Chat**: Instant messaging with the AI bot
- 📱 **Responsive**: Works seamlessly on desktop and mobile devices
- ⚡ **Loading States**: Visual feedback while waiting for responses
- 🌍 **Multi-language Support**: Integrated with next-intl for internationalization

## Usage

### Starting the Chat

1. Navigate to `/chat` route in your browser
2. Type your question in the input field at the bottom
3. Press Enter or click the send button
4. Wait for the AI assistant to respond

### API Integration

The chat interface connects to the backend RAG endpoint:

**Endpoint**: `POST http://localhost:3000/api/ingest/rag`

**Request Body**:
```json
{
  "question": "Your question here"
}
```

**Response**:
```json
{
  "question": "Your question",
  "answer": "AI-generated answer",
  "contextCount": 3,
  "context": [...]
}
```

## Components

### ChatInterface.tsx

Main chat component with the following features:
- Message history with user and bot messages
- Auto-scrolling to latest messages
- Loading indicators with animated dots
- Error handling for failed requests
- Timestamp display for each message

### Chat Page

Located at `app/[locale]/chat/page.tsx`, this page:
- Wraps the ChatInterface component
- Includes the LanguageSwitcher for internationalization
- Provides a full-screen chat experience

## Customization

### Styling

The interface uses Tailwind CSS with:
- Gradient backgrounds (blue to purple)
- Dark mode support via `dark:` classes
- Smooth animations and transitions
- Responsive layouts with flexbox

### Colors

Main color scheme:
- Primary: Blue (600) to Purple (600)
- Background: Zinc-50 (light) / Zinc-950 (dark)
- Text: Zinc-800 (light) / Zinc-200 (dark)

### API Endpoint

To change the backend URL, update the fetch call in `ChatInterface.tsx`:

```typescript
const response = await fetch('YOUR_API_URL_HERE', {
  // ...
});
```

## Development

### Running Locally

1. **Start the backend server** (on port 3000):
```bash
cd backend
npm run dev
```

2. **Configure the frontend** (optional):
```bash
cd frontend
# Copy the environment example file
cp env.example .env.local
# Edit .env.local if needed (default API URL is http://localhost:3000)
```

3. **Start the frontend**:
```bash
cd frontend
npm run dev
```

By default, Next.js will try to run on port 3000. If port 3000 is already taken by the backend, it will prompt you to run on port 3001.

4. Open your browser:
   - If frontend is on port 3001: http://localhost:3001/en/chat
   - If frontend is on port 3000: http://localhost:3000/en/chat (backend must be on different port)

**Recommended setup**: Backend on port 3000, Frontend on port 3001

### Building for Production

```bash
npm run build
npm start
```

## Future Enhancements

Potential improvements:
- [ ] Message persistence (localStorage/database)
- [ ] File upload support
- [ ] Markdown rendering in bot responses
- [ ] Voice input/output
- [ ] Message reactions
- [ ] Chat history export
- [ ] Typing indicators
- [ ] Multi-turn conversation context
