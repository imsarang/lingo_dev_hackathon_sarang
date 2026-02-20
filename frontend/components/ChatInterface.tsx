'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import ExampleQuestions from './ExampleQuestions';

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

const STORAGE_KEY = 'chat_messages';
const SESSION_KEY = 'chat_session_id';

export default function ChatInterface() {
  const params = useParams();
  const locale = params.locale as string || 'en';
  const t = useTranslations('chat');
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchTranslations = async (locale: string) => {
    // Mark translation as in progress
    localStorage.setItem('isTranslating', 'true');

    try {
      // Step 2: Get messages from localStorage
      const messagesStr = localStorage.getItem(STORAGE_KEY);
      if (!messagesStr) return;
      
      const messages = JSON.parse(messagesStr);
      if (!Array.isArray(messages) || messages.length === 0) return;
      
      // Step 3: Call translation API
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: messages, 
          targetLocale: locale 
        }),
      });

      if (!response.ok) {
        throw new Error(`Translation failed: ${response.status}`);
      }

      // Step 4: Read the streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Cannot read response stream');
      }

      const decoder = new TextDecoder();
      let textBuffer = '';
      // Start with current messages as base
      const allTranslatedMessages: Message[] = messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));

      // Step 5: Read chunks from the stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break; // Stream finished

        // Decode the chunk and add to buffer
        textBuffer += decoder.decode(value, { stream: true });
        
        // Split by double newline (SSE message separator)
        const completeMessages = textBuffer.split('\n\n');
        textBuffer = completeMessages.pop() || ''; // Keep incomplete message

        // Step 6: Process each complete message
        for (const messageText of completeMessages) {
          if (!messageText.trim()) continue;

          // Parse SSE format: "event: type\ndata: {...}"
          const eventLine = messageText.match(/^event: (.+)$/m);
          const dataLine = messageText.match(/^data: (.+)$/m);
          
          if (!eventLine || !dataLine) continue;

          const eventType = eventLine[1]; // 'message', 'complete', or 'error'
          const eventData = JSON.parse(dataLine[1]);

          // Step 7: Handle different event types
          if (eventType === 'token') {
            // Token streaming - update message as it's being translated
            const index = eventData.index;
            const originalMessage = allTranslatedMessages[index];
            allTranslatedMessages[index] = {
              ...originalMessage,
              content: eventData.accumulated
            };
            // Update UI in real-time as tokens arrive
            setMessages([...allTranslatedMessages]);
          }
          else if (eventType === 'message') {
            // A single message was fully translated - final update
            const index = eventData.index;
            const originalMsg = allTranslatedMessages[index] || messages[index];
            allTranslatedMessages[index] = {
              ...originalMsg,
              ...eventData.message,
              content: eventData.message.content || originalMsg?.content || '',
              timestamp: new Date(eventData.message.timestamp || originalMsg?.timestamp || new Date())
            };
            // Update UI with final translation
            setMessages([...allTranslatedMessages]);
          } 
          else if (eventType === 'complete') {
            // All messages translated - save everything
            const finalMessages = eventData.messages.map((msg: any, idx: number) => {
              const originalMsg = messages[idx] || allTranslatedMessages[idx];
              return {
                ...originalMsg,
                ...msg,
                content: msg.content || originalMsg?.content || '',
                timestamp: new Date(msg.timestamp || originalMsg?.timestamp || new Date())
              };
            });
            setMessages(finalMessages);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(finalMessages));
          } 
          else if (eventType === 'error') {
            console.error('Translation error:', eventData.message);
          }
        }
      }
    } catch (err) {
      console.error('Error translating messages:', err);
    } finally {
      // Mark translation as complete
      localStorage.setItem('isTranslating', 'false');
    }
  }

  // Load messages from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const savedSession = localStorage.getItem(SESSION_KEY);
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setMessages(parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })));
      } catch (error) {
        console.error('Error loading messages:', error);
      }
    }
    
    if (savedSession) {
      setSessionId(savedSession);
    }
    fetchTranslations(locale)
  }, [locale]); // Reload when locale changes

  // Save to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    if (sessionId) {
      localStorage.setItem(SESSION_KEY, sessionId);
    }
  }, [sessionId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const clearChat = () => {
    setMessages([]);
    setSessionId(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SESSION_KEY);
  };

  const updateBotMessage = (id: string, content: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === id ? { ...msg, content } : msg
    ));
  };

  const handleSSEStream = async (reader: ReadableStreamDefaultReader, botMessageId: string) => {
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        const eventMatch = line.match(/^event: (.+)$/m);
        const dataMatch = line.match(/^data: (.+)$/m);
        if (!eventMatch || !dataMatch) continue;

        const eventType = eventMatch[1];
        const data = JSON.parse(dataMatch[1]);

        switch (eventType) {
          case 'token':
            updateBotMessage(botMessageId, data.accumulated);
            break;
          case 'session':
            if (data.sessionId) setSessionId(data.sessionId);
            break;
          case 'complete':
            updateBotMessage(botMessageId, data.answer);
            if (data.sessionId) setSessionId(data.sessionId);
            setIsLoading(false);
            break;
          case 'error':
            updateBotMessage(botMessageId, data.message || t('errors.general'));
            setIsLoading(false);
            break;
        }
      }
    }
  };

  const sendMessage = async (messageContent: string) => {
    if (!messageContent.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: messageContent.trim(),
      timestamp: new Date(),
    };

    const botMessageId = (Date.now() + 1).toString();
    const botMessage: Message = {
      id: botMessageId,
      type: 'bot',
      content: '',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage, botMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/ingest/rag/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: messageContent,
          locale,
          sessionId
        }),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      await handleSSEStream(reader, botMessageId);
    } catch (error) {
      console.error('Error sending message:', error);
      updateBotMessage(botMessageId, t('errors.general'));
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto bg-white dark:bg-zinc-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t('header.title')}</h1>
            <p className="text-blue-100 text-sm mt-1">{t('header.subtitle')}</p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium"
            >
              {t('header.clearButton')}
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-zinc-50 dark:bg-zinc-950">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-full p-6 mb-4">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
              {t('emptyState.title')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-md mb-6">
              {t('emptyState.description')}
            </p>
            <div className="max-w-md w-full">
              <ExampleQuestions onQuestionClick={setInput} />
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                  message.type === 'user'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                    : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 shadow-md border border-zinc-200 dark:border-zinc-700'
                }`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                  <span className={`text-xs mt-2 block ${
                    message.type === 'user' ? 'text-blue-100' : 'text-zinc-500 dark:text-zinc-500'
                  }`}>
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[70%] rounded-2xl px-4 py-3 bg-white dark:bg-zinc-800 shadow-md border border-zinc-200 dark:border-zinc-700">
                  <div className="flex space-x-2">
                    {[0, 0.1, 0.2].map((delay, i) => (
                      <div key={i} className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: `${delay}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-lg">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('input.placeholder')}
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-800 dark:text-zinc-200 placeholder-zinc-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-md"
          >
            {isLoading ? (
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
