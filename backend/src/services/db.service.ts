import { prisma } from '../db/prismaClient'
import { MessageRole } from '@prisma/client'

class DBService{
    async getOrCreateUser(googleId: string, email: string, name?: string){
            const user = await prisma.user.upsert({
            where: { googleId },
            update: { email, name: name || undefined },
            create: { googleId, email, name: name || undefined, role: 'free' }
            })
            return user
    }

    async getOrCreateChatSession(sessionUuid: string, userId: bigint){
            const session = await prisma.chatSession.upsert({
            where: { sessionUuid },
                update: {},
            create: { sessionUuid, userId }
            })
            return session
    }

    async createUserMessage(sessionId: bigint, content: string, locale: string, englishContent?: string){
            const message = await prisma.message.create({
            data: {
                    sessionId,
                    role: MessageRole.user,
                    content,
                    locale,
                    englishContent: englishContent || null
                }
            })
            return message
        }

    async createAssistantMessage(sessionId: bigint, content: string, locale: string, englishContent?: string, vectorId?: string){
            const message = await prisma.message.create({
                data: {
                    sessionId,
                    role: MessageRole.assistant,
                    content,
                    locale,
                    englishContent: englishContent || null,
                    vectorId: vectorId || null
                }
            })
            return message
    }

    async getUserChatSessions(userId: bigint){
        const sessions = await prisma.chatSession.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                sessionUuid: true,
                createdAt: true,
                _count: {
                    select: { messages: true }
                }
            }
        })
        return sessions
    }

    async getSessionMessages(sessionId: bigint){
        const messages = await prisma.message.findMany({
            where: { sessionId },
            orderBy: { createdAt: 'asc' },
            select: {
                id: true,
                role: true,
                content: true,
                locale: true,
                englishContent: true,
                createdAt: true
            }
        })
        return messages
    }

    async getSessionByUuid(sessionUuid: string){
        const session = await prisma.chatSession.findUnique({
            where: { sessionUuid },
            include: {
                messages: {
                    orderBy: { createdAt: 'asc' },
                    select: {
                        id: true,
                        role: true,
                        content: true,
                        locale: true,
                        englishContent: true,
                        createdAt: true
                    }
                }
            }
        })
        return session
    }

    async deleteChatSession(sessionId: bigint){
        // Delete messages first (due to foreign key constraint)
        await prisma.message.deleteMany({
            where: { sessionId }
        })
        // Then delete the session
        await prisma.chatSession.delete({
            where: { id: sessionId }
        })
    }
}

export const dbService = new DBService()