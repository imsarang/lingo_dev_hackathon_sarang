// S3 service
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import { ExtractedPDF } from "../core/metadata";

export class S3Service {
    private s3Client: S3Client | null = null

    constructor(){
        if (!this.s3Client){
            this.s3Client = new S3Client({
                region: process.env.AWS_REGION || "us-east-1",
                credentials: {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
                },
            })
        }
    }

    async downloadFile(
        bucket: string,
        key: string,
    ): Promise<Buffer> {
        try{
            const command = new GetObjectCommand({
                Bucket: bucket,
                Key: key
            })

            const response = await this.s3Client?.send(command)
            if(response?.Body instanceof Readable){
                const chunks: Buffer[] = []
                for await (const chunk of response.Body){
                    chunks.push(chunk)
                }
                return Buffer.concat(chunks)
            }
            throw new Error("Invalid response from S3")
        }
        catch(err){
            console.log("Error downloading file from S3", err);
            throw err
        }
    }

    async getFileText(
        bucket: string,
        key: string
    ): Promise<ExtractedPDF> {
        try{
            const fileBuffer = await this.downloadFile(bucket, key)
            
            const pdfParse = require('pdf-parse')
            const data = await pdfParse(fileBuffer)
            
            return {
                text: data.text,
                totalPages: data.numpages
            }
        }
        catch(err){
            console.log("Error getting file text from S3", err);
            throw err
        }
    }
}

export const s3Service = new S3Service()
