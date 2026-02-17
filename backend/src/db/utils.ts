// ChromaDB utility functions for data inspection and management
import { vectorDBClient } from './client';

export class ChromaDBUtils {
    /**
     * Get all documents in the collection
     */
    async getAllDocuments() {
        try {
            await vectorDBClient.initialize();
            const collection = (vectorDBClient as any).collection;
            
            if (!collection) {
                throw new Error('Collection not initialized');
            }

            const result = await collection.get();
            return {
                count: result.ids?.length || 0,
                ids: result.ids || [],
                documents: result.documents || [],
                metadatas: result.metadatas || [],
                embeddings: result.embeddings || []
            };
        } catch (error) {
            console.error('Error getting all documents:', error);
            throw error;
        }
    }

    /**
     * Get document count
     */
    async getDocumentCount(): Promise<number> {
        try {
            await vectorDBClient.initialize();
            const collection = (vectorDBClient as any).collection;
            
            if (!collection) {
                throw new Error('Collection not initialized');
            }

            const result = await collection.count();
            return result;
        } catch (error) {
            console.error('Error getting document count:', error);
            throw error;
        }
    }

    /**
     * Get documents by IDs
     */
    async getDocumentsByIds(ids: string[]) {
        try {
            await vectorDBClient.initialize();
            const collection = (vectorDBClient as any).collection;
            
            if (!collection) {
                throw new Error('Collection not initialized');
            }

            const result = await collection.get({
                ids: ids
            });
            
            return {
                ids: result.ids || [],
                documents: result.documents || [],
                metadatas: result.metadatas || []
            };
        } catch (error) {
            console.error('Error getting documents by IDs:', error);
            throw error;
        }
    }

    /**
     * Get documents by metadata filter
     */
    async getDocumentsByMetadata(filter: Record<string, any>) {
        try {
            await vectorDBClient.initialize();
            const collection = (vectorDBClient as any).collection;
            
            if (!collection) {
                throw new Error('Collection not initialized');
            }

            const result = await collection.get({
                where: filter
            });
            
            return {
                count: result.ids?.length || 0,
                ids: result.ids || [],
                documents: result.documents || [],
                metadatas: result.metadatas || []
            };
        } catch (error) {
            console.error('Error getting documents by metadata:', error);
            throw error;
        }
    }

    /**
     * Delete documents by IDs
     */
    async deleteDocumentsByIds(ids: string[]) {
        try {
            await vectorDBClient.initialize();
            const collection = (vectorDBClient as any).collection;
            
            if (!collection) {
                throw new Error('Collection not initialized');
            }

            await collection.delete({
                ids: ids
            });
            
            console.log(`Deleted ${ids.length} documents`);
            return { success: true, deletedCount: ids.length };
        } catch (error) {
            console.error('Error deleting documents:', error);
            throw error;
        }
    }

    /**
     * Delete documents by metadata filter
     */
    async deleteDocumentsByMetadata(filter: Record<string, any>) {
        try {
            await vectorDBClient.initialize();
            const collection = (vectorDBClient as any).collection;
            
            if (!collection) {
                throw new Error('Collection not initialized');
            }

            await collection.delete({
                where: filter
            });
            
            console.log(`Deleted documents matching filter`);
            return { success: true };
        } catch (error) {
            console.error('Error deleting documents by metadata:', error);
            throw error;
        }
    }

    /**
     * Get collection info
     */
    async getCollectionInfo() {
        try {
            await vectorDBClient.initialize();
            const collection = (vectorDBClient as any).collection;
            
            if (!collection) {
                throw new Error('Collection not initialized');
            }

            const count = await collection.count();
            
            return {
                name: (vectorDBClient as any).collectionName,
                count: count,
                metadata: collection.metadata || {}
            };
        } catch (error) {
            console.error('Error getting collection info:', error);
            throw error;
        }
    }
}

export const chromaUtils = new ChromaDBUtils();
