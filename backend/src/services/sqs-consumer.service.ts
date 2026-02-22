import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, Message } from '@aws-sdk/client-sqs';
import { ingestionService, IngestionRequest } from './ingestion.service';

interface S3EventRecord {
  s3: {
    bucket: { name: string };
    object: { key: string };
  };
}

export class SQSConsumerService {
  private sqsClient: SQSClient;
  private queueUrl: string;
  private maxMessages: number = 10;
  private waitTimeSeconds: number = 20;
  private isRunning: boolean = false;

  constructor() {
    this.sqsClient = new SQSClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });

    this.queueUrl = process.env.SQS_QUEUE_URL || '';
    
    // Don't throw error in constructor - allow graceful handling
    if (!this.queueUrl) {
      console.warn('[SQS CONSUMER] ⚠️  SQS_QUEUE_URL not set. Consumer will not start.');
    }
  }

  /**
   * Main consumer loop - continuously polls SQS for messages
   * 
   * This consumer:
   * - Polls SQS queue for messages containing S3 file references
   * - When messages arrive, downloads files from S3 and ingests them into vector DB
   * - Does NOT ingest existing docs on startup - only processes new SQS messages
   * - Runs continuously until stopped
   */
  async start(): Promise<void> {
    if (!this.queueUrl) {
      throw new Error('SQS_QUEUE_URL environment variable is required to start consumer');
    }

    this.isRunning = true;
    console.log('[SQS CONSUMER] 🚀 Starting SQS Vector Ingestion Consumer...');
    console.log(`[SQS CONSUMER] 📬 Queue URL: ${this.queueUrl}`);

    while (this.isRunning) {
      try {
        const messages = await this.receiveMessages();
        
        if (messages.length === 0) {
          console.log('[SQS CONSUMER] ⏳ No messages received, waiting...');
          continue;
        }

        console.log(`[SQS CONSUMER] 📨 Received ${messages.length} message(s)`);

        // Process messages in parallel
        const promises = messages.map(message => this.processMessage(message));
        await Promise.allSettled(promises);

      } catch (error) {
        console.error('[SQS CONSUMER] ❌ Error in consumer loop:', error);
        // Wait before retrying
        await this.sleep(5000);
      }
    }
  }

  /**
   * Stop the consumer
   */
  stop(): void {
    console.log('[SQS CONSUMER] 🛑 Stopping consumer...');
    this.isRunning = false;
  }

  /**
   * Receive messages from SQS queue
   */
  private async receiveMessages(): Promise<Message[]> {
    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: this.maxMessages,
        WaitTimeSeconds: this.waitTimeSeconds,
        MessageAttributeNames: ['All'],
        AttributeNames: ['All'],
      });

      const response = await this.sqsClient.send(command);
      return response.Messages || [];
    } catch (error) {
      console.error('[SQS CONSUMER] ❌ Error receiving messages from SQS:', error);
      throw error;
    }
  }

  /**
   * Process a single SQS message
   */
  private async processMessage(message: Message): Promise<void> {
    const receiptHandle = message.ReceiptHandle;
    
    if (!receiptHandle) {
      console.error('[SQS CONSUMER] ⚠️ Message missing receipt handle');
      return;
    }

    try {
      console.log(`[SQS CONSUMER] 🔄 Processing message: ${message.MessageId}`);

      // Parse SQS message body (could be S3 event or custom format)
      const body = JSON.parse(message.Body || '{}');
      
      // Handle S3 event format
      let s3Records: S3EventRecord[] = [];
      
      if (body.Records) {
        // Direct S3 event format (from S3 -> SQS integration)
        s3Records = body.Records.filter((r: any) => r.eventSource === 'aws:s3');
      } else if (body.s3) {
        // Single S3 record
        s3Records = [{ s3: body.s3 }];
      } else if (body.bucket && body.key) {
        // Custom format with bucket and key
        s3Records = [{
          s3: {
            bucket: { name: body.bucket },
            object: { key: body.key }
          }
        }];
      }

      if (s3Records.length === 0) {
        console.warn('[SQS CONSUMER] ⚠️ No S3 records found in message');
        await this.deleteMessage(receiptHandle);
        return;
      }

      // Process each S3 file using existing ingestion service
      for (const record of s3Records) {
        const bucket = record.s3.bucket.name;
        const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
        
        await this.processS3File(bucket, key);
      }

      // Delete message after successful processing
      await this.deleteMessage(receiptHandle);
      console.log(`[SQS CONSUMER] ✅ Successfully processed message: ${message.MessageId}`);

    } catch (error) {
      console.error(`[SQS CONSUMER] ❌ Error processing message ${message.MessageId}:`, error);
      // Don't delete message on error - let it go back to queue for retry
      // Or implement dead letter queue logic here
    }
  }

  /**
   * Process file from S3 using existing ingestion service
   */
  private async processS3File(bucket: string, key: string): Promise<void> {
    console.log(`[SQS CONSUMER] 📥 Processing file: s3://${bucket}/${key}`);

    try {
      // Use existing ingestion service - it handles:
      // - S3 file download (via s3Service)
      // - File parsing (via fileProcessingService)
      // - Chunking (via chunkingService)
      // - Vector DB ingestion (via vectorDBClient)
      const ingestionRequest: IngestionRequest = {
        s3Bucket: bucket,
        s3Key: key,
        metadata: {
          source: 'sqs-consumer',
          processedAt: new Date().toISOString(),
        }
      };

      const result = await ingestionService.ingestDocumentFromS3(ingestionRequest);

      if (result.status === 'success') {
        console.log(`[SQS CONSUMER] ✅ Successfully ingested ${result.chunksProcessed} chunks from ${key}`);
        console.log(`[SQS CONSUMER] 📄 Document ID: ${result.documentId}`);
      } else {
        console.error(`[SQS CONSUMER] ❌ Failed to ingest ${key}: ${result.error}`);
        throw new Error(result.error || 'Ingestion failed');
      }

    } catch (error) {
      console.error(`[SQS CONSUMER] ❌ Error processing S3 file ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete processed message from SQS
   */
  private async deleteMessage(receiptHandle: string): Promise<void> {
    try {
      const command = new DeleteMessageCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: receiptHandle,
      });

      await this.sqsClient.send(command);
    } catch (error) {
      console.error('[SQS CONSUMER] ❌ Error deleting message:', error);
      throw error;
    }
  }

  /**
   * Utility: Sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const sqsConsumerService = new SQSConsumerService();
