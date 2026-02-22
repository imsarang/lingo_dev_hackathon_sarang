/**
 * File Processing Service
 * Processes uploaded files directly from form data/stream (no S3 storage)
 */

import { ExtractedPDF } from "../core/metadata";

export class FileProcessingService {
    /**
     * Parse PDF file from buffer
     */
    async parsePDF(buffer: Buffer): Promise<ExtractedPDF> {
        try {
            const pdfParse = require('pdf-parse');
            const data = await pdfParse(buffer);
            
            return {
                text: data.text,
                totalPages: data.numpages
            };
        } catch (error) {
            console.error('[FILE PROCESSING] Error parsing PDF:', error);
            throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Parse TXT file from buffer
     */
    async parseTXT(buffer: Buffer): Promise<ExtractedPDF> {
        try {
            const text = buffer.toString('utf-8');
            return {
                text: text,
                totalPages: 1
            };
        } catch (error) {
            console.error('[FILE PROCESSING] Error parsing TXT:', error);
            throw new Error(`Failed to parse TXT: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Parse file from buffer based on file type
     */
    async parseFile(buffer: Buffer, filename: string): Promise<ExtractedPDF> {
        const filenameLower = filename.toLowerCase();
        
        if (filenameLower.endsWith('.pdf')) {
            return this.parsePDF(buffer);
        } else if (filenameLower.endsWith('.txt')) {
            return this.parseTXT(buffer);
        } else {
            throw new Error(`Unsupported file type: ${filename}. Only PDF and TXT files are supported.`);
        }
    }
}

export const fileProcessingService = new FileProcessingService();
