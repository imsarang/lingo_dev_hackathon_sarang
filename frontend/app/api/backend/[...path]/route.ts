import { NextRequest } from "next/server";

const BACKEND_INTERNAL_URL = process.env.BACKEND_INTERNAL_URL || 'http://localhost:3001'

async function proxy(req: NextRequest, context: {params: {path: string[]}}){
    const {path} = context.params

    const targetPath = '/' + path.join('/')
    const url = new URL(targetPath, BACKEND_INTERNAL_URL)
    const reqUrl = new URL(req.url)
    url.search = reqUrl.search

    const headers = new Headers(req.headers)
    headers.delete('host')

    const backendResponse = await fetch(url.toString(), {
        method: req.method,
        headers,
        body: req.body || undefined,
        redirect: 'manual'
    });

    return new Response(backendResponse.body, {
        status: backendResponse.status,
        statusText: backendResponse.statusText,
        headers: backendResponse.headers
    })
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE };