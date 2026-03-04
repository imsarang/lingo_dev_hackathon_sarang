## AI Document Assistant – Interview Q&A

### 1. What problem does your AI Document Assistant solve?

This project helps users understand complex documents, especially financial and business reports, even if they aren’t in the user’s native language. Users can upload PDFs or other formats, chat with the document using a RAG pipeline, and run a report analyzer that extracts sentiment, risks, key metrics, and improvement suggestions. It also supports multi-language UX and translation so users can read and interact with content in their preferred language.

**Keywords:** RAG, document understanding, financial reports, multilingual, report analyzer, AI assistant

---

### 2. What are the main user-facing features?

There are two main user flows: the **chat interface** and the **report analyzer**. In the chat interface, users ask natural-language questions about their uploaded documents, and the system streams back answers with context. In the report analyzer, users upload a report and get section-wise content, sentiment, risk factors, benchmarking vs peers, and AI-generated improvements for specific sections. Both flows are localized into multiple languages.

**Keywords:** chat interface, report analyzer, streaming responses, section-wise analysis, benchmarking, localization

---

### 3. How do guest users and logged-in users differ in your app?

Guest users can still chat, but their session state and messages are stored locally in `localStorage`, not in the database. Logged-in users authenticate via NextAuth, send an ID token to the backend, and their chat sessions and messages are stored in Postgres. Logged-in users also get session listing, delete options, and PDF export of conversations across sessions.

**Keywords:** NextAuth, guest vs authenticated, `localStorage`, session persistence, Postgres, session messages

---

### 4. Walk me through the end-to-end flow when a user asks a question in the chat.

On the frontend, `ChatInterface` adds a user message to state, creates a placeholder bot message, and calls the backend `/api/ingest/rag/stream` endpoint with the question, locale, and optional `sessionId`. The backend runs the RAG pipeline: it queries ChromaDB for relevant chunks, builds a prompt using those chunks and optional conversation history, then calls the HuggingFace model with streaming. The backend sends SSE events (`token`, `session`, `complete`) back to the frontend. The frontend parses the SSE stream and updates the bot message content incrementally, and also updates or stores the `sessionId` for future messages.

**Keywords:** SSE, streaming, RAG pipeline, ChromaDB, HuggingFace Inference, `sessionId`, `ChatInterface`

---

### 5. How do you maintain conversation context across multiple questions?

On the backend, we persist chat messages per session in Postgres. When a new question arrives with a `sessionId`, the backend can reconstruct relevant conversation history and pass it into the prompt builder along with the retrieved chunks. On the frontend, `ChatInterface` also keeps all messages for the current session in state and, for guests, in `localStorage`. This allows us to build prompts that consider previous turns to keep the conversation coherent.

**Keywords:** conversation history, session-based context, Postgres, prompt building, state management, `localStorage`

---

### 6. How does voice input work in your chat interface?

We use the browser’s `SpeechRecognition` / `webkitSpeechRecognition` API on the client side. When the user starts recording, we set up recognition with the appropriate locale (for example, `en-US`), handle the `onresult` callback to set the input field with the recognized transcript, and then the user can send it like a normal text message. We also manage UI state like `listening` to give feedback and disable the button while the browser is listening.

**Keywords:** Web Speech API, `SpeechRecognition`, locale-aware voice input, client-side only, `listening` state

---

### 7. What’s the user journey in the Report Analyzer?

The user uploads a PDF, DOCX, or TXT file. The backend extracts text, chunks it into semantic sections, analyzes each chunk, and caches everything with a generated `sessionId`. The frontend receives metadata, per-section content, chunk analyses, and initial sentiment. The user can then navigate between Executive Summary, Risk Factors, Financial Overview, run deeper Expert Analysis (which produces strengths, weaknesses, benchmarking, and suggestions), and click **AI Improve** for a specific section to get improved content and examples.

**Keywords:** file upload, chunking, section mapping, expert analysis, AI Improve, `sessionId`, cached analysis

---

### 8. How do you structure the report into sections on the frontend?

We define a fixed list of logical sections in `ReportAnalyzer` (`executive-summary`, `risk-factors`, `financial-overview`). On the backend, each chunk is annotated with a `sectionType` like `risk_factors` or `financial_performance`. We map backend `sectionType` to frontend section IDs using `SECTION_TYPE_MAP`, and concatenate chunks per section into long text areas that the user can read or edit.

**Keywords:** section mapping, `SECTION_TYPE_MAP`, chunk-to-section aggregation, textarea editing, semantic sections

---

### 9. How does the “AI Improve” feature work for a specific section?

When the user clicks **AI Improve** on a section, the frontend sends the `sessionId` and `sectionId` to the backend `/api/reports/improve` endpoint. The backend uses cached chunks and analysis to create a prompt that asks the LLM for improved content and structured improvement details (before/after examples, types, descriptions). The frontend receives this response, does some post-processing (because models sometimes wrap JSON as strings), stores improved content per section, displays it with bullets, and allows the user to apply the improved content back into the editable text area.

**Keywords:** per-section improvement, structured JSON from LLM, before/after examples, post-processing, apply-improvement UX

---

### 10. How do you restore a previous report session when the user revisits?

We persist a `reportSessionId` in `localStorage` after a successful upload. When `ReportAnalyzer` mounts, it checks for `reportSessionId` and, if found, calls `/api/reports/:sessionId` to load cached metadata, chunks, analyses, and any expert analysis. We rebuild section texts from chunks, recompute some metrics like total risk count and average sentiment, and restore everything in state. We also track the source locale in `localStorage` to decide if we need to translate the content later.

**Keywords:** session restore, `reportSessionId`, `localStorage`, cached report, state hydration, locale tracking

---

### 11. How is your backend structured in terms of layers and responsibilities?

The backend follows a layered structure: **routes → controllers → services → core/db/utils**. Routes define the URL paths and attach middleware. Controllers handle HTTP concerns and orchestrate the request (validate input, call services, shape responses). Services encapsulate business logic (RAG retrieval, report analysis, translation, caching, S3, DB access). Core modules like `chunking`, `retriever`, and `metadata` implement domain-specific algorithms. DB access is centralized in Prisma/DB utilities, and cross-cutting concerns like auth and uploads are implemented as Express middleware.

**Keywords:** layered architecture, routes/controllers/services, separation of concerns, core modules, middleware, Prisma

---

### 12. Explain the design of the `RetrieverService` for RAG.

`RetrieverService` is a class that keeps HuggingFace client configuration and exposes `queryWithRAG` (non-streaming) and `queryWithRAGStream` (streaming). Internally it builds filters from natural language using `classifyIntent` and `extractEntities`, queries ChromaDB via `vectorDBClient`, and then generates an answer via `callLLMWithRetry` using either `chatCompletionStream` or `textGenerationStream`. It maintains a simple `RAGState` with steps `retrieve → generate → complete`. This encapsulation makes the RAG flow testable and reusable.

**Keywords:** `RetrieverService`, `RAGState`, intent classification, entity extraction, ChromaDB query, HuggingFace streaming, retry logic

---

### 13. How did you implement SSE (Server-Sent Events) in your Express controllers?

In controllers like `translate.controller`, we set the appropriate headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, and CORS headers where needed. We define a `sendEvent` helper that writes lines in the `event:` + `data:` SSE format. As the underlying service (for example, translation stream) yields tokens, we call `sendEvent('token', data)`, and at the end we send `complete` and close the response with `res.end()`. We also handle error cases by sending an `error` event before ending.

**Keywords:** SSE protocol, `text/event-stream`, `sendEvent`, streaming tokens, `res.write`, `res.end`

---

### 14. How do you handle HuggingFace streaming responses which can have different formats?

In `RetrieverService.callLLMStream`, we first try `chatCompletionStream`, which yields chunks with `choices[0].delta.content`. If that fails with “not supported”, we fall back to `textGenerationStream`, where tokens come under `chunk.token.text` or sometimes full `generated_text`. We maintain an `accumulatedAnswer` string and for each chunk compute the new token, append it, and call the `onToken` callback. At the end we return the full accumulated answer or throw if nothing was received.

**Keywords:** `chatCompletionStream`, `textGenerationStream`, chunk formats, `delta.content`, `generated_text`, accumulated buffer, fallback

---

### 15. How do you design the caching layer for report analysis?

We use a dedicated `cacheService` that abstracts Redis operations. When a report is uploaded and processed, we cache an object containing metadata, sentiment, analyses, and chunks keyed by `sessionId`. We also cache derived structures like section-wise improvements and expert analysis separately. Controllers like `report.controller.getReport` use `cacheService.getCachedReport` and `getCachedAnalysis` to quickly serve data without re-running expensive LLM calls.

**Keywords:** Redis, `cacheService`, session-based caching, avoiding recomputation, `sessionId` keys, read-through style

---

### 16. How is state managed in `ChatInterface`?

We use React `useState` and `useEffect`. `messages` holds the chat history, `sessionId` ties messages to backend sessions, and `sessions` holds server-side sessions for logged-in users. We also track flags like `isLoading`, `isTranslating`, `listening`, and translation progress. Side effects include: loading/saving messages to `localStorage` for guests, fetching sessions from the API for logged-in users, auto-scrolling, and triggering translation when the locale changes.

**Keywords:** `useState`, `useEffect`, `localStorage`, NextAuth session, `isLoading`, `isTranslating`, side effects

---

### 17. How did you implement the streaming UI for chat answers on the frontend?

After sending the fetch request, we take `response.body.getReader()` and manually parse the stream with a `TextDecoder`. We buffer incoming chunks, split by blank lines, then for each SSE message we parse `event:` and `data:` lines. For `token` events, we update the current bot message content with the `accumulated` field. For `complete`, we set the final answer and possibly update the `sessionId`. This gives a smooth token-by-token typing effect.

**Keywords:** `ReadableStream`, `getReader`, `TextDecoder`, SSE parsing, incremental UI updates, token streaming

---

### 18. How did you implement translation streaming on the frontend?

The translation logic is very similar to chat streaming. We send a POST to `/api/translate` with an array of messages and source/target locales. We then read the response body as SSE, parse `token`, `message`, and `complete` events, and maintain an `allTranslatedMessages` array. The `token` events incrementally update a message’s `content` at a given index; `message` and `complete` finalize content. We also track `translationProgress` and disable interactions while translating.

**Keywords:** translation SSE, messages array, index-based updates, `translationProgress`, disabled UI, streaming reuse

---

### 19. How do you avoid race conditions or redundant translations in `ReportAnalyzer`?

We use guard conditions at the start of translation-related effects: if `isTranslating` is true, or if the source and target locales are the same, or there is no data to translate, we return early. We also track “original” versions of sections, analyses, and expert analysis separately so that repeated translations always use the canonical English source rather than re-translating already translated content, which reduces drift.

**Keywords:** guards in `useEffect`, `isTranslating` flag, original vs translated state, idempotent translation, avoiding drift

---

### 20. How is localization designed in the frontend?

We use Next.js App Router with dynamic `[locale]` segments and `next-intl` for translations. Routes like `/[locale]/chat` and `/[locale]/analyzer` are locale-aware. We load translation messages per locale and use hooks like `useTranslations` in components. The `LanguageSwitcher` component updates the route to a different locale, and we also persist the last used locale for some features like chat translations and reports to decide when to trigger translation via the backend.

**Keywords:** App Router, dynamic `[locale]` routes, `next-intl`, `useTranslations`, locale-based routing, language switcher

---

### 21. Describe the high-level architecture of your system.

We have a Next.js frontend deployed on Vercel and an Express.js backend deployed on EC2 with Docker. The backend talks to Postgres via Prisma, Redis for caching, ChromaDB as the vector database, AWS S3 for file storage, HuggingFace Inference for LLMs, and Lingo.dev for translations. The frontend communicates with the backend over REST/SSE endpoints. Authentication is handled by NextAuth on the frontend; we pass an ID token in each API call for auth and authorization.

**Keywords:** Vercel, EC2, Docker, Postgres + Prisma, Redis, ChromaDB, S3, HuggingFace, Lingo.dev, REST, SSE, NextAuth

---

### 22. How would you scale this system for more users and larger documents?

We would horizontally scale the backend using multiple container instances behind a load balancer, making sure all instances share Redis, Postgres, and ChromaDB (or a managed vector DB). We would offload heavy tasks like ingestion and analysis to background workers via SQS or a similar queue. We use S3 for large files, aggressive caching in Redis for analysis results, and rate limiting per user. For very large documents, we can batch chunking, limit max tokens, and optimize ChromaDB queries to reduce retrieval overhead.

**Keywords:** horizontal scaling, load balancer, background workers, SQS, Redis caching, rate limiting, vector DB scaling, S3 offloading

---

### 23. How do you handle long-running tasks like report analysis without blocking?

The main approach is to break tasks into steps: initial upload and chunking, then separate endpoints for expert analysis and improvements. Each call is bounded, and we cache intermediate results in Redis keyed by `sessionId`. We also have SQS consumer infrastructure prepared so ingestion from S3 or batch processing can run asynchronously. On the frontend we show spinners and clear messages while we wait for responses, but we avoid any long synchronous processes in request handlers.

**Keywords:** task decomposition, bounded operations, Redis caching, SQS consumer, async processing, non-blocking controllers

---

### 24. How is security handled, especially around user data and documents?

Authentication uses NextAuth and ID tokens, which are passed as Bearer tokens from the frontend. On the backend, an auth middleware can validate tokens and attach user info to requests so routes can distinguish guests vs users and enforce ownership of sessions. Documents are stored in S3, which is configured with secure buckets and access controls. Sensitive data like API keys and DB credentials are in environment variables. We use HTTPS in production, and we avoid embedding user PII directly into logs or prompts.

**Keywords:** NextAuth, Bearer tokens, auth middleware, S3 security, environment variables, HTTPS, PII minimization

---

### 25. How would you add multi-tenancy (multiple organizations) to this system?

We would introduce a `tenantId` associated with each user and with each resource: sessions, documents, embeddings, caches. In Postgres, tables would have `tenantId` columns; in ChromaDB we would either use separate collections per tenant or store `tenantId` in metadata and filter on it. Redis keys would be namespaced by tenant. On the frontend, user context would include the active tenant, and APIs would enforce tenant isolation at the service layer.

**Keywords:** multi-tenancy, `tenantId`, data isolation, collection per tenant, metadata filters, key namespacing

---

### 26. What performance optimizations have you applied?

We use Redis to cache heavy computation results like report analysis and expert analysis. We chunk documents into smaller pieces so retrieval and analysis can be parallelized and targeted. The RAG retrieval uses metadata filters to reduce search space. API calls to HuggingFace use streaming and retry with exponential backoff on rate limits. On the frontend, we avoid unnecessary refetching by storing sessions locally and reusing cached data where possible.

**Keywords:** Redis caching, chunking, metadata filters, exponential backoff, streaming, reduced reprocessing, client-side caching

---

### 27. How do you handle failures from external APIs like HuggingFace or Lingo.dev?

We wrap external calls in `try/catch` and use helper methods to normalize messages. For HuggingFace we implement a retry loop that distinguishes rate-limit errors from authentication errors; we retry a few times with exponential backoff for transient issues and fail fast for auth issues. For translations, we send SSE `error` events and a graceful error message to the frontend, which then shows a generic error to the user.

**Keywords:** error handling, retry with backoff, transient vs fatal errors, SSE `error` events, user-friendly messages, resilience

---

## Conceptual & Deep-Dive Questions

### 28. In LLD terms, how do you decide when to create a new service class vs adding a method to an existing one?

I look at **single responsibility** and **change patterns**. If a piece of logic has a distinct responsibility (for example, translation vs RAG vs caching) and could reasonably change or be replaced independently, it becomes its own service (like `translate-lingo.service`, `retriever.service`, `cache.service`). If it’s just a small variation on an existing responsibility, I add a method. I also consider dependencies: if adding a method would bring in new external dependencies or make the class know about too many concerns, that’s a signal to extract a new service.

**Keywords:** single responsibility principle (SRP), cohesion, coupling, service boundary, change isolation

---

### 29. How would you refactor this project to enforce a clean architecture or hexagonal architecture?

I would formalize layers as **domain**, **application**, **infrastructure**, and **presentation (API)**. Domain would hold pure business logic (interfaces for retrievers, translators, analyzers). Application layer would orchestrate use cases (e.g. “AskQuestionUseCase”, “AnalyzeReportUseCase”). Infrastructure would implement interfaces for HuggingFace, ChromaDB, Redis, S3, and Postgres. Controllers and routes would sit at the edge, calling use cases and mapping HTTP to domain models. This reduces coupling to specific libraries and makes it easier to test and swap components.

**Keywords:** clean architecture, hexagonal architecture, use cases, ports and adapters, domain vs infrastructure

---

### 30. How do you ensure your LLD supports testability, especially for LLM/RAG code?

I rely on **dependency injection** and **interfaces**. For example, instead of hard-coding HuggingFace or ChromaDB calls everywhere, I wrap them in clients (`InferenceClient`, `vectorDBClient`) that can be replaced with mocks in tests. The RAG flow in `RetrieverService` is written as a pure function over a `RAGState` plus injected dependencies, so I can test: (1) filter building, (2) iteration of `retrieve → generate → complete`, and (3) error handling, independent of the actual LLM. For E2E flows, I use small models or fixed responses.

**Keywords:** dependency injection, interfaces, mocking, pure functions, testability, RAG pipeline tests

---

### 31. What are the key trade-offs you considered in your system design?

The main trade-offs were between **cost vs quality vs latency**. Using HuggingFace Inference with an 8B model gives better answers than very small models but costs more and can be slower; we mitigate this with caching and good retrieval. ChromaDB is simple to self-host but less “turnkey” than some managed vector DBs. Streaming SSE improves perceived latency but complicates frontend parsing logic. Also, keeping everything in TypeScript simplifies development but means we rely on Node for CPU-bound tasks like parsing, which is less optimal than a compiled language.

**Keywords:** cost–latency–quality trade-off, managed vs self-hosted, SSE complexity, single-language stack

---

### 32. How would you design rate limiting and abuse protection for this system?

I would introduce **per-user and per-IP rate limits** at a reverse proxy or API gateway (for example, Nginx or an API gateway service). Limits would be stricter on LLM-heavy endpoints (`/api/ingest/rag/stream`, `/api/reports/analyze`, `/api/reports/improve`). Redis can be used as a centralized store for counters using token bucket or leaky bucket algorithms. I’d also add maximum document size and max requests per minute per user/tenant, and optionally CAPTCHAs or “soft” limits for anonymous users.

**Keywords:** rate limiting, token bucket, Redis counters, per-user/per-IP quotas, abuse protection

---

### 33. How would you evolve the system to support real-time collaboration (multiple users on the same report)?

I’d introduce a **collaboration session** abstraction and a WebSocket layer (or WebRTC + signaling server). The document content could be managed with **CRDTs** or Operational Transform to handle concurrent edits. Each user’s client would subscribe to updates for a given report/session, and the backend would broadcast changes. For AI features, we’d decide whether to share a common AI “view” of the document or keep insights per user; either way, caching and session IDs would need to be extended to be collaboration-aware.

**Keywords:** real-time collaboration, WebSockets, CRDT, OT, shared sessions, broadcast updates

---

### 34. What metrics would you track to evaluate the quality of your LLM-based answers?

I’d combine **automatic metrics** and **user-driven metrics**. Automatically, I’d track answer length, retrieval overlap (how much of the answer is grounded in retrieved chunks), and basic semantic similarity between question and answer. On the user side, I’d capture thumbs up/down feedback, follow-up question frequency, and whether users copy/export content. For more rigorous evaluation, I could create a small labeled test set with “good/bad” answers and compute accuracy or preference rates for different prompts/models.

**Keywords:** answer quality, grounding, semantic similarity, user feedback, A/B testing, labeled evaluation set

---

### 35. How would you measure and improve the effectiveness of your RAG retrieval?

I’d log which chunks are retrieved for each question and whether the final answer cites those chunks. Then I’d run offline experiments using a **gold dataset** of questions with known relevant passages and compute **Recall@k** and **MRR** for retrieval. To improve, I could tune chunking (size, overlap), add better metadata filters, switch embedding models, or re-rank retrieved chunks with a lightweight cross-encoder before passing them to the LLM.

**Keywords:** Recall@k, MRR, gold dataset, chunking strategy, embeddings, re-ranking

---

### 36. How do you think about hallucination risk in this system and how would you mitigate it?

Hallucinations are risky because users are reading financial and business content. To mitigate, I focus on **strong grounding** (only send relevant chunks), explicit instructions in the prompt to quote from the document, and, where possible, include citations (chunk IDs or page numbers) in answers. I’d also add guardrails: if no relevant chunks are found, answer with “I don’t know based on this document” instead of guessing. Over time, we could introduce a separate verification model that checks if answers are supported by the retrieved text.

**Keywords:** hallucination, grounding, citations, guardrails, verification model, “I don’t know” behavior

---

### 37. What deployment considerations are specific to LLM/RAG systems compared to normal web apps?

LLM/RAG systems are **heavier** on latency and external dependencies. We need to design for variable response times, handle streaming properly, and plan capacity for spikes in LLM requests. Caching and batching become more important to control cost. Monitoring needs to include not just CPU/memory but also external API latency, error rates, and model-specific metrics. We also need a safe way to roll out prompt or model changes (feature flags, A/B tests) without breaking existing behavior.

**Keywords:** latency, LLM capacity planning, cost control, streaming deployment, prompt rollout, A/B experiments

---

### 38. How would you design blue/green or canary deployments for your backend?

I’d containerize the backend and run two versions (blue and green) behind a load balancer. For **blue/green**, traffic is switched entirely from one version to the other after smoke tests. For **canary**, a small percentage of traffic goes to the new version, and we monitor error rates, latency, and key business metrics; if metrics are good, we gradually increase traffic. Database migrations would be designed to be backward-compatible during the rollout (expand-and-contract pattern).

**Keywords:** blue/green deployment, canary release, load balancer, backward-compatible migrations, expand-and-contract

---

### 39. How would you handle secrets management (API keys, DB passwords, etc.) in production?

I’d avoid hard-coding secrets in code or committing them to Git. Instead, I’d use environment variables injected by the deployment platform and, ideally, a secrets manager (AWS Secrets Manager, HashiCorp Vault, or similar) to store and rotate them. Containers would read only the minimal set of secrets they need. Access to the secrets manager itself would be controlled via IAM roles. On the app side, I’d centralize config loading (like your `env.ts`) to validate presence and fail fast on misconfiguration.

**Keywords:** secrets management, env vars, secrets manager, rotation, least privilege, centralized config

---

### 40. Conceptually, what are the main differences between RAG and fine-tuning?

RAG keeps the base LLM fixed and augments it with **external context** at query time via retrieval, whereas fine-tuning changes the model weights using new training data. RAG is more flexible and safer for frequently changing or private data because you just update the vector store; fine-tuning is better for shaping style or behavior across tasks. RAG also lets you answer questions about content that’s too large to fit into the model context by retrieving only relevant pieces.

**Keywords:** RAG vs fine-tuning, external knowledge, dynamic context, model weights, private data

---

### 41. How would you evaluate the translation quality provided by Lingo.dev in this system?

I’d start with **human evaluation** on a representative sample of languages and document types, rating adequacy (meaning preserved) and fluency. For automated checks, I could use back-translation and BLEU/COMET-style metrics as a rough signal. In the app, I’d track how often users switch back to English after seeing a translation, or how often they re-run analysis in another language. For critical flows, we might add a “view original” toggle so users can compare directly.

**Keywords:** translation quality, human evaluation, BLEU/COMET, back-translation, user behavior signals

---

### 42. What general software engineering practices help when working with LLM-heavy projects?

I rely on **observability, versioning, and data discipline**. Observability means logging prompts, responses (with redaction), and latency; versioning means tracking which prompt and model version produced which answer; data discipline means careful handling of user data and building small, curated evaluation sets. I also use feature flags for new prompts or features, and keep prompts and configuration in code or config files instead of scattering strings across the codebase.

**Keywords:** observability, prompt versioning, evaluation sets, feature flags, config-driven prompts, data discipline

---

