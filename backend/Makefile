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

# SQS Consumer
sqs-consumer:
	npm run sqs-consumer

dev-with-consumer:
	ENABLE_SQS_CONSUMER=true npm run dev

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

clear-cache:
	@curl -X POST $(API_URL)/api/ingest/cache/clear \
		-H "Content-Type: application/json" \
		-d '{}' | jq

delete:
	@curl -X DELETE $(API_URL)/api/chromadb/documents \
		-H "Content-Type: application/json" \
		-d '{"filter":{"documentId":"$(ID)"}}' | jq

clean-db:
	@echo "Deleting ChromaDB data..."
	@rm -rf chroma_data
	@echo "ChromaDB cleared! Restart ChromaDB server."

# Help
help:
	@echo "Commands:"
	@echo "  make dev              - Start server"
	@echo "  make dev-with-consumer - Start server with SQS consumer"
	@echo "  make sqs-consumer     - Run SQS consumer separately"
	@echo "  make stats            - Get stats"
	@echo "  make count            - Get count"
	@echo "  make list             - List docs"
	@echo "  make ingest BUCKET=x KEY=y ID=z"
	@echo "  make query Q='your question'"
	@echo "  make rag Q='your question'  - LangGraph RAG query"
	@echo "  make ask Q='your question'  - Intent-based query"
	@echo "  make clear-cache      - Clear Redis cache"
	@echo "  make delete ID=doc-id"
	@echo "  make clean-db         - Delete all ChromaDB data"

.PHONY: dev build dev-with-consumer sqs-consumer stats count list ingest query rag ask clear-cache delete clean-db help
