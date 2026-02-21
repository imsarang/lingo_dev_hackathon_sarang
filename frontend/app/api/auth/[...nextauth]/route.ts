import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"

const handler = NextAuth({
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID || '',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
            authorization: {
                params: {
                    access_type: 'offline',
                    prompt: 'consent',
                }
            }
        })
    ],
    secret: process.env.NEXTAUTH_SECRET,
    pages: {
        signIn: '/',
        error: '/',
    },
    callbacks: {
        async signIn({ user, account, profile }) {
            if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
                console.error('Missing Google OAuth credentials')
                return false
            }
            return true
        },
        async redirect({ url, baseUrl }) {
            // Always use full URL if provided (preserves port)
            if (url.startsWith("http://") || url.startsWith("https://")) {
                return url
            }
            // For relative URLs, use baseUrl
            if (url.startsWith("/")) {
                return `${baseUrl}${url}`
            }
            return baseUrl
        },
        async jwt({token, user, account, profile, isNewUser, trigger}){
            // Refresh token on session access
            if (trigger === 'update' && account?.id_token) {
                token.idToken = account.id_token
            }
            
            if(user && account){
                token.googleId = account.providerAccountId
                token.email = user.email
                token.name = user.name
                token.image = user.image
                token.idToken = account.id_token
                token.refreshToken = account.refresh_token

                if(isNewUser || !token.userSynced){
                    try{
                        const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
                        await fetch(`${backendUrl}/api/users/upsert`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                googleId: account.providerAccountId,
                                email: user.email,
                                name: user.name,
                                image: user.image
                            })
                        })
                        token.userSynced = true
                    }
                    catch(err){
                        console.error('Failed to sync user to backend:', err)
                    }
                }
            }
            return token
        },
        async session({session, token}){
            if(token && session.user){
                // Add googleId to user object
                (session.user as any).googleId = token.googleId as string
                (session as any).idToken = token.idToken
            }
            return session
        }
    },
    debug: process.env.NODE_ENV === 'development',
})

export {handler as GET, handler as POST}
