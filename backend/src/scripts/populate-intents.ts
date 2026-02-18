import { ChromaClient } from "chromadb";

async function setupIntentExamples(){
    const client = new ChromaClient({
        path: 'http://localhost:8000'
    })

    try{
        const collection = await client.getOrCreateCollection({
            name: 'query_intents',
            metadata: {
                description: 'Intent classification examples'
            }
        })

        const examples = [
            // INFORMATION
            { text: 'What is the revenue?', intent: 'INFORMATION' },
            { text: 'Tell me about the company', intent: 'INFORMATION' },
            { text: 'Show me details', intent: 'INFORMATION' },
            { text: 'What are the key highlights?', intent: 'INFORMATION' },
            { text: 'Give me information about', intent: 'INFORMATION' },
            
            // ANALYSIS
            { text: 'Analyze the financial performance', intent: 'ANALYSIS' },
            { text: 'What are the trends?', intent: 'ANALYSIS' },
            { text: 'How did the company perform?', intent: 'ANALYSIS' },
            { text: 'Evaluate the growth', intent: 'ANALYSIS' },
            { text: 'Assess the market position', intent: 'ANALYSIS' },
            
            // COMPARISON
            { text: 'Compare Company A and Company B', intent: 'COMPARISON' },
            { text: 'Difference between X and Y', intent: 'COMPARISON' },
            { text: 'Which is better?', intent: 'COMPARISON' },
            { text: 'X versus Y analysis', intent: 'COMPARISON' },
            { text: 'How do they compare?', intent: 'COMPARISON' },
        ]

        await collection.add({
            ids: examples.map((_, i) => `example-${i}`),
            documents: examples.map(e => e.text),
            metadatas: examples.map(e => ({ intent: e.intent })),
        })

        console.log("Intents collection created and populated with examples");
    }
    catch(err){
        console.error("Error populating intents", err);
        throw err;
    }
}