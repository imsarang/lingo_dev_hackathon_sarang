'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import ExampleQuestions from './ExampleQuestions';
import LanguageSwitcher from './LanguageSwitcher';
import { AuthComponent } from './AuthComponent';
import { getLanguageName } from '@/utils/languageNames';
import { getSession, useSession } from 'next-auth/react';

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

const STORAGE_KEYS = {
  MESSAGES: 'chat_messages',
  SESSION_ID: 'chat_session_id',
  SELECTED_SESSION: 'selectedSessionId',
  CURRENT_LOCALE: 'currentLocale',
  IS_TRANSLATING: 'isTranslating'
};

import { getApiUrl } from '@/config/api';

export default function ChatInterface() {
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string || 'en';
  const t = useTranslations('chat');
  const { data: session } = useSession();
  
  // Core states
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Session states
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEYS.SELECTED_SESSION) || null;
    }
    return null;
  });
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  // Translation states
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationSource, setTranslationSource] = useState<string | null>(null);
  const [translationTarget, setTranslationTarget] = useState<string | null>(null);
  const [translationProgress, setTranslationProgress] = useState(0);

  // Voice states
  const [listening, setListening] = useState(false);
  const [browserSupportsSpeechRecognition, setBrowserSupportsSpeechRecognition] = useState(false);
  const recognitionRef = useRef<any>(null);
  const workerRef = useRef<Worker | null>(null);

  // Helper: Get auth headers
  const getAuthHeaders = async () => {
    const currentSession = await getSession();
    const idToken = (currentSession as any)?.idToken;
    return {
      'Content-Type': 'application/json',
      ...(idToken && { 'Authorization': `Bearer ${idToken}` }),
      'x-user-role': currentSession?.user ? 'user' : 'guest'
    };
  };

  // Helper: Handle 401 errors
  const handle401 = async () => {
    const { signOut } = await import('next-auth/react');
    await signOut({ redirect: false });
    alert('Your session has expired. Please log in again.');
  };

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const isSupported = !!SpeechRecognition;
    setBrowserSupportsSpeechRecognition(isSupported);
    
    if (isSupported) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = locale === 'en' ? 'en-US' : locale;
      recognitionRef.current.onstart = () => setListening(true);
      recognitionRef.current.onresult = (e: any) => {
        setInput(e.results[0][0].transcript);
      };
      recognitionRef.current.onerror = () => setListening(false);
      recognitionRef.current.onend = () => setListening(false);
    }
  }, [locale]);

  // Load initial data based on user status
  useEffect(() => {
    if (session?.user) {
      // Logged in: clear guest data and fetch sessions
      localStorage.removeItem(STORAGE_KEYS.MESSAGES);
      localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
      if (sessions.length === 0) {
        fetchSessions();
      }
    } else {
      // Guest: load from localStorage
      const saved = localStorage.getItem(STORAGE_KEYS.MESSAGES);
      const savedSession = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
      
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
    }
  }, [session?.user?.email]);

  // Save guest messages to localStorage
  useEffect(() => {
    if (!session?.user && messages.length > 0) {
      localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
    }
  }, [messages, session?.user]);

  // Persist selectedSessionId
  useEffect(() => {
    if (selectedSessionId) {
      localStorage.setItem(STORAGE_KEYS.SELECTED_SESSION, selectedSessionId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.SELECTED_SESSION);
    }
  }, [selectedSessionId]);

  // Restore selected session messages on mount/locale change
  useEffect(() => {
    if (!session?.user || messages.length > 0 || isTranslating || sessions.length === 0) return;
    
    const persistedSessionId = localStorage.getItem(STORAGE_KEYS.SELECTED_SESSION);
    if (persistedSessionId) {
      if (selectedSessionId !== persistedSessionId) {
        setSelectedSessionId(persistedSessionId);
      }
      fetchSessionMessages(persistedSessionId);
    }
  }, [session?.user?.email, sessions.length, locale]);

  // Translate messages when locale changes
  useEffect(() => {
    if (session === undefined || isTranslating) return;
    
    const previousLocale = localStorage.getItem(STORAGE_KEYS.CURRENT_LOCALE) || 'en';
    if (previousLocale === locale) return;

    let messagesToTranslate: Message[] = [];
    
    if (session?.user) {
      if (!selectedSessionId || messages.length === 0) return;
      messagesToTranslate = messages;
    } else {
      const messagesStr = localStorage.getItem(STORAGE_KEYS.MESSAGES);
      if (!messagesStr) return;
      
      try {
        const parsed = JSON.parse(messagesStr);
        if (!Array.isArray(parsed) || parsed.length === 0) return;
        messagesToTranslate = parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      } catch (error) {
        return;
      }
    }
    
    setTimeout(() => fetchTranslations(locale, messagesToTranslate), 300);
  }, [locale, session?.user?.email, messages.length, selectedSessionId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchSessions = async () => {
    try {
      const currentSession = await getSession({ triggerEvent: true });
      if (!currentSession?.user) return;

      const idToken = (currentSession as any)?.idToken;
      if (!idToken) return;

      setIsLoadingSessions(true);
      const response = await fetch(getApiUrl('/api/users/sessions'), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) await handle401();
        return;
      }

      const data = await response.json();
      if (data.success && data.sessions) {
        setSessions(data.sessions);
      }
    } catch (err) {
      console.error('[SESSIONS] Error:', err);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const fetchSessionMessages = async (sessionUuid: string) => {
    if ((selectedSessionId === sessionUuid && messages.length > 0) || isTranslating) return;

    try {
      const currentSession = await getSession({ triggerEvent: true });
      if (!currentSession?.user) return;

      const idToken = (currentSession as any)?.idToken;
      if (!idToken) return;

      setSelectedSessionId(sessionUuid);
      setSessionId(sessionUuid);
      setMessages([]);

      const response = await fetch(getApiUrl(`/api/users/sessions/${sessionUuid}/messages`), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error('[MESSAGES] Failed:', response.status);
        return;
      }

      const data = await response.json();
      if (data.success && data.messages) {
        setMessages(data.messages.map((msg: any) => ({
          id: msg.id,
          type: msg.role === 'user' ? 'user' : 'bot',
          content: msg.content,
          timestamp: new Date(msg.createdAt)
        })));
      }
    } catch (err) {
      console.error('[MESSAGES] Error:', err);
    }
  };

  const deleteSession = async (sessionUuid: string) => {
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    try {
      const currentSession = await getSession({ triggerEvent: true });
      if (!currentSession?.user) return;

      const idToken = (currentSession as any)?.idToken;
      if (!idToken) return;

      const response = await fetch(getApiUrl(`/api/users/sessions/${sessionUuid}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          await handle401();
          return;
        }
        alert('Failed to delete conversation');
        return;
      }

      setSessions(sessions.filter(s => s.sessionUuid !== sessionUuid));
      
      if (selectedSessionId === sessionUuid) {
        setMessages([]);
        setSelectedSessionId(null);
        setSessionId(null);
        localStorage.removeItem(STORAGE_KEYS.SELECTED_SESSION);
      }
    } catch (err) {
      console.error('[DELETE] Error:', err);
      alert('Error deleting conversation');
    }
  };

  const fetchTranslations = async (targetLocale: string, messagesToTranslate: Message[]) => {
    if (!Array.isArray(messagesToTranslate) || messagesToTranslate.length === 0) return;
    
    const currentSession = await getSession();
    const isLoggedIn = !!currentSession?.user;
    
    setIsTranslating(true);
    const sourceLocale = localStorage.getItem(STORAGE_KEYS.CURRENT_LOCALE) || 'en';
    setTranslationSource(sourceLocale);
    setTranslationTarget(targetLocale);
    setTranslationProgress(10);
    localStorage.setItem(STORAGE_KEYS.CURRENT_LOCALE, targetLocale);
    localStorage.setItem(STORAGE_KEYS.IS_TRANSLATING, 'true');

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(getApiUrl('/api/translate'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          messages: messagesToTranslate, 
          sourceLocale,
          targetLocale 
        }),
      });

      if (!response.ok) {
        throw new Error(`Translation failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Cannot read response stream');

      const decoder = new TextDecoder();
      let textBuffer = '';
      const allTranslatedMessages: Message[] = messagesToTranslate.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });
        const completeMessages = textBuffer.split('\n\n');
        textBuffer = completeMessages.pop() || '';

        for (const messageText of completeMessages) {
          if (!messageText.trim()) continue;

          const eventLine = messageText.match(/^event: (.+)$/m);
          const dataLine = messageText.match(/^data: (.+)$/m);
          if (!eventLine || !dataLine) continue;

          const eventType = eventLine[1];
          const eventData = JSON.parse(dataLine[1]);

          if (eventType === 'token') {
            const index = eventData.index;
            allTranslatedMessages[index] = {
              ...allTranslatedMessages[index],
              content: eventData.accumulated
            };
            setMessages([...allTranslatedMessages]);
          } else if (eventType === 'message') {
            const index = eventData.index;
            allTranslatedMessages[index] = {
              ...allTranslatedMessages[index],
              ...eventData.message,
              content: eventData.message.content || allTranslatedMessages[index]?.content || '',
              timestamp: new Date(eventData.message.timestamp || allTranslatedMessages[index]?.timestamp || new Date())
            };
            setTranslationProgress(Math.round(((index + 1) / messagesToTranslate.length) * 100));
            setMessages([...allTranslatedMessages]);
          } else if (eventType === 'complete') {
            setTranslationProgress(100);
            const finalMessages = eventData.messages.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            }));
            setMessages(finalMessages);
            if (!isLoggedIn) {
              localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(finalMessages));
            }
          } else if (eventType === 'error') {
            console.error('Translation error:', eventData.message);
          }
        }
      }
    } catch (err) {
      console.error('Error translating messages:', err);
    } finally {
      setIsTranslating(false);
      setTranslationSource(null);
      setTranslationTarget(null);
      setTranslationProgress(0);
      localStorage.setItem(STORAGE_KEYS.IS_TRANSLATING, 'false');
    }
  };

  const handleVoiceStart = () => {
    if (!session || !recognitionRef.current) return;
    recognitionRef.current.start();
  };

  const handleVoiceStop = () => {
    recognitionRef.current?.stop();
  };

  const clearChat = () => {
    setMessages([]);
    setSessionId(null);
    localStorage.removeItem(STORAGE_KEYS.MESSAGES);
    localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
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
      const headers = await getAuthHeaders();
      const response = await fetch(getApiUrl('/api/ingest/rag/stream'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          question: messageContent,
          locale,
          sessionId
        }),
      });

      if (!response.ok) {
        let errorMessage = `Error: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      await handleSSEStream(reader, botMessageId);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = error instanceof Error ? error.message : t('errors.general');
      updateBotMessage(botMessageId, errorMessage);
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const savePdf = () => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("../workers/pdfWorker.ts", import.meta.url),
        { type: 'module' }
      );

      workerRef.current.onmessage = (event: MessageEvent) => {
        const { success, pdfBlob, error } = event.data;
        if (success && pdfBlob) {
          const url = URL.createObjectURL(pdfBlob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "conversation.pdf";
          a.click();
          URL.revokeObjectURL(url);
        } else {
          console.error("Error generating PDF:", error);
        }
      };
    }

    if (workerRef.current) {
      workerRef.current.postMessage({ messages });
    }
  };

  return (
    <div className="flex h-screen w-full bg-white dark:bg-zinc-900">
      {/* Left Sidebar - 1/3 width */}
      <div className="w-1/3 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 shadow-lg flex flex-col">
        <div className="flex flex-col h-full">
          <div className="mb-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => router.push(`/${locale}`)}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium text-white"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Home
              </button>
              <AuthComponent />
            </div>
            <LanguageSwitcher />
          </div>

          {/* Sessions List - Only for logged-in users */}
          {session?.user && (
            <div className="mb-6 flex-1 overflow-y-auto custom-scrollbar">
              <h3 className="text-sm font-medium text-white mb-3">Conversations</h3>
              {isLoadingSessions ? (
                <div className="text-center text-blue-100 text-sm">Loading...</div>
              ) : sessions.length === 0 ? (
                <div className="text-center text-blue-100 text-sm">No conversations yet</div>
              ) : (
                <div className="space-y-2">
                  {sessions.map((sess) => (
                    <div
                      key={sess.id}
                      className={`w-full rounded-lg transition-colors flex items-center justify-between gap-2 px-3 py-2 ${
                        selectedSessionId === sess.sessionUuid
                          ? 'bg-white text-blue-600'
                          : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                    >
                      <button
                        onClick={() => fetchSessionMessages(sess.sessionUuid)}
                        disabled={isTranslating}
                        className="flex-1 text-left disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="text-xs font-medium truncate">
                          {new Date(sess.createdAt).toLocaleDateString()}
                        </div>
                        <div className={`text-xs mt-1 ${
                          selectedSessionId === sess.sessionUuid
                            ? 'text-blue-500'
                            : 'text-blue-100'
                        }`}>
                          {sess.messageCount} messages
                        </div>
                      </button>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (selectedSessionId === sess.sessionUuid && messages.length > 0) {
                              savePdf();
                            } else {
                              fetchSessionMessages(sess.sessionUuid).then(() => {
                                setTimeout(() => savePdf(), 500);
                              });
                            }
                          }}
                          disabled={isTranslating}
                          className="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          PDF
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSession(sess.sessionUuid);
                          }}
                          disabled={isTranslating}
                          className="px-2 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Voice Input */}
          <div className="mb-6">
            <div className="bg-white/10 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-white">Voice Input</h3>
                {!browserSupportsSpeechRecognition && (
                  <span className="text-xs text-yellow-300">Not supported</span>
                )}
              </div>
              
              {browserSupportsSpeechRecognition && (
                <>
                  {!session && (
                    <div className="text-xs text-yellow-300 bg-yellow-500/20 rounded p-2 text-center">
                      Please log in to use voice input
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={listening ? handleVoiceStop : handleVoiceStart}
                      disabled={isLoading || !session}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all font-medium ${
                        listening
                          ? 'bg-red-500 hover:bg-red-600 text-white'
                          : 'bg-white/20 hover:bg-white/30 text-white'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {listening ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Listening...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                          <span>Start Voice</span>
                        </>
                      )}
                    </button>
                  </div>
                  
                  {listening && (
                    <div className="flex items-center gap-2 text-blue-100 text-xs">
                      <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                      <span>Speak now...</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          
          <div>
            <h1 className="text-2xl font-bold">{t('header.title')}</h1>
            {isTranslating && (
              <div className="mt-2">
                <div className="flex items-center gap-2 text-blue-100 text-xs mb-1">
                  <div className="w-3 h-3 border-2 border-blue-100 border-t-transparent rounded-full animate-spin" />
                  <span>
                    {translationSource && translationTarget && translationSource !== translationTarget
                      ? t('translation.fromTo', {
                          source: getLanguageName(translationSource),
                          target: getLanguageName(translationTarget)
                        })
                      : t('translation.inProgress')
                    }
                  </span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-white h-1.5 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${Math.max(0, Math.min(100, translationProgress))}%` }}
                  />
                </div>
              </div>
            )}
            <p className="text-blue-100 text-sm mt-1">{t('header.subtitle')}</p>
          </div>
          
          {messages.length > 0 && (
            <div className='flex flex-col gap-2 mt-4'>
              <button
                onClick={savePdf}
                disabled={isTranslating}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-medium self-start flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {t('header.savePdf')}
              </button>
              <button
                onClick={clearChat}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium self-start"
              >
                {t('header.clearButton')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages - 2/3 width */}
      <div className="w-2/3 flex flex-col bg-zinc-50 dark:bg-zinc-950">
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
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
    </div>
  );
}
