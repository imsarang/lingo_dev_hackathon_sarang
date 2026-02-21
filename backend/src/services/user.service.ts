import { prisma } from '../db/prismaClient'

export interface UpsertUserRequest {
    googleId: string
    email: string
    name?: string
    image?: string
}

class UserService {
    async upsert(data: UpsertUserRequest) {
        const { googleId, email, name, image } = data
        try {
            const user = await prisma.user.upsert({
                where: {
                    googleId: googleId
                },
                update: {
                    email: email,
                    name: name || undefined
                },
                create: {
                    googleId: googleId,
                    email: email,
                    name: name,
                    role: 'free'
                }
            })
            return user
        }
        catch (err) {
            console.error('Error upserting user:', err)
            throw err
        }
    }

    async findByGoogleId(googleId: string){
        try {
            const user = await prisma.user.findUnique({
                where: { googleId }
            })
            return user
        }
        catch (err) {
            console.error('Error finding user by googleId:', err)
            throw err
        }
    }
}

export const userService = new UserService()