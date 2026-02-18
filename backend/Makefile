# Makefile for Lingo Dev Backend

API_URL = http://localhost:3000
BUCKET = lingo-dev-hackathon
KEY = reliance/RIL-Annual-Report-2022-23.pdf
ID = test-doc-123

# Server
dev:
	npm run dev

build:
	npm run build

# API Testing
stats:
	@curl -s $(API_URL)/api/chromadb/stats | jq

count:
	@curl -s $(API_URL)/api/chromadb/documents/count | jq

list:
	@curl -s "$(API_URL)/api/chromadb/documents?limit=10" | jq

ingest:
	@curl -X POST $(API_URL)/api/ingest/ingest \
		-H "Content-Type: application/json" \
		-d '{"s3Bucket":"$(BUCKET)","s3Key":"$(KEY)","documentId":"$(ID)"}' | jq

query:
	@curl -X POST $(API_URL)/api/ingest/query \
		-H "Content-Type: application/json" \
		-d '{"query":"$(Q)","nResults":5}' | jq

rag:
	@curl -X POST $(API_URL)/api/ingest/rag \
		-H "Content-Type: application/json" \
		-d '{"question":"$(Q)"}' | jq

ask:
	@curl -X POST $(API_URL)/api/question/ask \
		-H "Content-Type: application/json" \
		-d '{"query":"$(Q)"}' | jq

delete:
	@curl -X DELETE $(API_URL)/api/chromadb/documents \
		-H "Content-Type: application/json" \
		-d '{"filter":{"documentId":"$(ID)"}}' | jq

# Help
help:
	@echo "Commands:"
	@echo "  make dev              - Start server"
	@echo "  make stats            - Get stats"
	@echo "  make count            - Get count"
	@echo "  make list             - List docs"
	@echo "  make ingest BUCKET=x KEY=y ID=z"
	@echo "  make query Q='your question'"
	@echo "  make rag Q='your question'  - LangGraph RAG query"
	@echo "  make ask Q='your question'  - Intent-based query"
	@echo "  make delete ID=doc-id"

.PHONY: dev build stats count list ingest query rag ask delete help
