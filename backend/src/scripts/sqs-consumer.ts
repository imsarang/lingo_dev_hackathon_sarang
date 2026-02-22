/**
 * SQS Consumer Script
 * 
 * This script runs the SQS consumer service that:
 * 1. Polls SQS queue for messages containing S3 file references
 * 2. Downloads files from S3
 * 3. Processes and chunks them using existing services
 * 4. Ingests them into the vector database
 * 
 * Usage:
 *   npm run sqs-consumer
 *   or
 *   ts-node src/scripts/sqs-consumer.ts
 * 
 * Environment Variables Required:
 *   - SQS_QUEUE_URL: The SQS queue URL to poll
 *   - AWS_REGION: AWS region (default: us-east-1)
 *   - AWS_ACCESS_KEY_ID: AWS access key
 *   - AWS_SECRET_ACCESS_KEY: AWS secret key
 *   - CHROMA_URL: ChromaDB URL (default: http://localhost:8000)
 */

import { sqsConsumerService } from '../services/sqs-consumer.service';

// Start the consumer
async function main() {
  try {
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n[SQS CONSUMER] 🛑 Received SIGINT, shutting down gracefully...');
      sqsConsumerService.stop();
      setTimeout(() => {
        process.exit(0);
      }, 2000);
    });

    process.on('SIGTERM', () => {
      console.log('\n[SQS CONSUMER] 🛑 Received SIGTERM, shutting down gracefully...');
      sqsConsumerService.stop();
      setTimeout(() => {
        process.exit(0);
      }, 2000);
    });

    // Start consuming
    await sqsConsumerService.start();
  } catch (error) {
    console.error('[SQS CONSUMER] 💥 Fatal error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export default main;
