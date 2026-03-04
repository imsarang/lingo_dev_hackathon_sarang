# 🚀 Converting to Server-Sent Events (SSE) for Streaming

## Overview

This guide shows how to convert the current sequential HTTP request/response pattern to **Server-Sent Events (SSE)** for real-time streaming of LLM responses. This provides:

- ✅ **Real-time token streaming** - Users see responses as they're generated
- ✅ **Progressive status updates** - Show what's happening (retrieving, generating, etc.)
- ✅ **Better perceived performance** - Feels much faster even if total time is same
- ✅ **Lower Time-to-First-Token (TTFT)** - Users see content immediately

---

## 📋 Implementation Steps

### **Step 1: Backend - Create SSE Streaming Endpoint**

**File:** `backend/src/controllers/ingest.controller.ts`

**What to do:**
- Create new `queryRAGStream` method
- Set SSE headers
- Stream events at each stage (cache check, retrieval, generation)
- Stream LLM tokens as they're generated

**Key Points:**
- Use `text/event-stream` content type
- Send events in SSE format: `data: {json}\n\n`
- Keep connection alive
- Handle errors gracefully

---

### **Step 2: Backend - Modify Retriever for Streaming**

**File:** `backend/src/core/retriever.ts`

**What to do:**
- Add `generateWithHistoryStream` method
- Use LLM streaming API
- Yield tokens as they arrive
- Send progress updates

**Key Points:**
- Use LangChain's `stream()` method
- Process tokens in chunks
- Send status updates between stages

---

### **Step 3: Backend - Update Ingestion Service**

**File:** `backend/src/services/ingestion.service.ts`

**What to do:**
- Create `queryWithRAGStream` method
- Accept callback for sending SSE events
- Stream cache check, translation, retrieval, generation stages

**Key Points:**
- Send events at each stage
- Include metadata (sessionId, status, etc.)
- Handle errors with error events

---

### **Step 4: Backend - Add Route**

**File:** `backend/src/routes/ingest.routes.ts`

**What to do:**
- Add new route: `POST /api/ingest/rag/stream`
- Map to `queryRAGStream` controller method

---

### **Step 5: Frontend - Replace Fetch with EventSource**

**File:** `frontend/components/ChatInterface.tsx`

**What to do:**
- Replace `fetch()` with `EventSource` or `fetch()` with streaming
- Handle different event types (status, token, complete, error)
- Update UI progressively as events arrive

**Key Points:**
- Use `EventSource` for SSE (simpler) OR `fetch()` with `ReadableStream` (more control)
- Handle reconnection
- Update message content incrementally

---

## 🔄 Event Flow

```
Frontend                    Backend
   |                           |
   |-- POST /rag/stream ------>|
   |                           |
   |<-- SSE: status:checking --|
   |                           |
   |<-- SSE: status:retrieving -|
   |                           |
   |<-- SSE: status:generating |
   |                           |
   |<-- SSE: token: "The" -----|
   |<-- SSE: token: " answer" -|
   |<-- SSE: token: " is..." --|
   |                           |
   |<-- SSE: complete: {...} --|
   |                           |
```

---

## 📝 Event Types

### **Status Events**
```json
{
  "type": "status",
  "status": "checking_cache" | "retrieving" | "generating" | "translating",
  "message": "Checking cache..."
}
```

### **Token Events**
```json
{
  "type": "token",
  "token": "The",
  "accumulated": "The answer is"
}
```

### **Complete Event**
```json
{
  "type": "complete",
  "answer": "Full answer text",
  "contextCount": 3,
  "sessionId": "uuid-here"
}
```

### **Error Event**
```json
{
  "type": "error",
  "message": "Error description"
}
```

---

## 🎯 Benefits

1. **Better UX** - Users see progress in real-time
2. **Lower Perceived Latency** - Content appears immediately
3. **Progressive Loading** - Can show partial results
4. **Status Visibility** - Users know what's happening
5. **No Breaking Changes** - Keep old endpoint for compatibility

---

## ⚠️ Important Notes

- **Keep old endpoint** - Don't break existing functionality
- **Handle reconnection** - SSE can disconnect
- **Error handling** - Send error events, don't just close connection
- **CORS** - Ensure SSE endpoint allows CORS
- **Connection limits** - Browsers limit concurrent SSE connections (usually 6)

---

## 🧪 Testing

1. **Test streaming** - Verify tokens arrive progressively
2. **Test error handling** - Ensure errors are sent as events
3. **Test reconnection** - Simulate network issues
4. **Test multiple tabs** - Verify connection limits
5. **Test old endpoint** - Ensure backward compatibility

---

## 📚 Resources

- [MDN: Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [LangChain Streaming](https://js.langchain.com/docs/guides/streaming)
- [Express SSE Example](https://github.com/expressjs/express/issues/3397)

---

## 🚀 Quick Start

1. Implement backend streaming endpoint
2. Update retriever to support streaming
3. Update frontend to use EventSource
4. Test with real queries
5. Monitor performance improvements

---

**Last Updated:** 2024-02-19  
**Status:** Ready for Implementation
