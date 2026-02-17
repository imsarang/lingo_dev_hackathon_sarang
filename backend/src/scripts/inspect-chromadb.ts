#!/usr/bin/env ts-node
// CLI tool to inspect ChromaDB data
// Load environment variables first
import '../env';
import { chromaUtils } from '../db/utils';

async function main() {
    const command = process.argv[2];

    try {
        switch (command) {
            case 'stats':
                await showStats();
                break;
            
            case 'count':
                await showCount();
                break;
            
            case 'list':
                await listDocuments();
                break;
            
            case 'get':
                const id = process.argv[3];
                if (!id) {
                    console.error('Usage: npm run inspect get <document-id>');
                    process.exit(1);
                }
                await getDocument(id);
                break;
            
            case 'search':
                const filter = process.argv[3];
                if (!filter) {
                    console.error('Usage: npm run inspect search \'{"documentId":"xxx"}\'');
                    process.exit(1);
                }
                await searchDocuments(JSON.parse(filter));
                break;
            
            case 'delete':
                const deleteId = process.argv[3];
                if (!deleteId) {
                    console.error('Usage: npm run inspect delete <document-id>');
                    process.exit(1);
                }
                await deleteDocument(deleteId);
                break;
            
            default:
                showHelp();
        }
    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

async function showStats() {
    console.log('\n📊 ChromaDB Collection Stats\n');
    const info = await chromaUtils.getCollectionInfo();
    console.log(`Collection Name: ${info.name}`);
    console.log(`Total Documents: ${info.count}`);
    console.log(`Metadata:`, JSON.stringify(info.metadata, null, 2));
    console.log('');
}

async function showCount() {
    const count = await chromaUtils.getDocumentCount();
    console.log(`\n📈 Total documents: ${count}\n`);
}

async function listDocuments() {
    console.log('\n📄 Listing all documents (limited to 20)\n');
    const result = await chromaUtils.getAllDocuments();
    
    if (result.count === 0) {
        console.log('No documents found.');
        return;
    }

    const limit = Math.min(20, result.ids.length);
    for (let i = 0; i < limit; i++) {
        console.log(`\n--- Document ${i + 1}/${result.count} ---`);
        console.log(`ID: ${result.ids[i]}`);
        console.log(`Metadata:`, JSON.stringify(result.metadatas[i], null, 2));
        console.log(`Text Preview: ${result.documents[i].substring(0, 150)}...`);
    }
    
    if (result.count > limit) {
        console.log(`\n... and ${result.count - limit} more documents`);
    }
    console.log('');
}

async function getDocument(id: string) {
    console.log(`\n🔍 Fetching document: ${id}\n`);
    const result = await chromaUtils.getDocumentsByIds([id]);
    
    if (result.ids.length === 0) {
        console.log('Document not found.');
        return;
    }

    console.log(`ID: ${result.ids[0]}`);
    console.log(`Metadata:`, JSON.stringify(result.metadatas[0], null, 2));
    console.log(`\nDocument Text:`);
    console.log(result.documents[0]);
    console.log('');
}

async function searchDocuments(filter: Record<string, any>) {
    console.log(`\n🔎 Searching with filter:`, JSON.stringify(filter, null, 2), '\n');
    const result = await chromaUtils.getDocumentsByMetadata(filter);
    
    if (result.count === 0) {
        console.log('No documents found matching the filter.');
        return;
    }

    console.log(`Found ${result.count} documents:\n`);
    for (let i = 0; i < result.ids.length; i++) {
        console.log(`\n--- Document ${i + 1} ---`);
        console.log(`ID: ${result.ids[i]}`);
        console.log(`Metadata:`, JSON.stringify(result.metadatas[i], null, 2));
        console.log(`Text Preview: ${result.documents[i].substring(0, 150)}...`);
    }
    console.log('');
}

async function deleteDocument(id: string) {
    console.log(`\n🗑️  Deleting document: ${id}\n`);
    const result = await chromaUtils.deleteDocumentsByIds([id]);
    console.log(`✅ Successfully deleted ${result.deletedCount} document(s)\n`);
}

function showHelp() {
    console.log(`
ChromaDB Inspector CLI

Usage:
  npm run inspect <command> [args]

Commands:
  stats                     Show collection statistics
  count                     Show total document count
  list                      List all documents (limited to 20)
  get <id>                  Get a specific document by ID
  search '<filter>'         Search documents by metadata filter (JSON)
  delete <id>               Delete a document by ID

Examples:
  npm run inspect stats
  npm run inspect list
  npm run inspect get doc-123_chunk_0
  npm run inspect search '{"documentId":"doc-123"}'
  npm run inspect delete doc-123_chunk_0
    `);
}

main();
