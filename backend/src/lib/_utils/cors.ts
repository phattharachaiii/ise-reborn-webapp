// src/lib/_utils/cors.ts
import { NextResponse } from 'next/server';

const FE_ORIGIN = process.env.FE_ORIGIN || 'http://localhost:5173';

export function withCORS(res: NextResponse, methods: string[] = ['GET']) {
    res.headers.set('Access-Control-Allow-Origin', FE_ORIGIN);
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.headers.set('Access-Control-Allow-Methods', [...methods, 'OPTIONS'].join(','));
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    return res;
}

export function preflight(methods: string[] = ['GET']) {
    return withCORS(new NextResponse(null, { status: 204 }), methods);
}
