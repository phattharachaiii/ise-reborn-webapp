// app/api/notifications/stream/route.ts
import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const FE_ORIGIN = process.env.FE_ORIGIN || 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET!;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

type Me = { sub: string; name?: string; role?: string; avatarUrl?: string | null };

function authFromReq(req: Request): Me | null {
    // 1) พยายามเอามาจาก Authorization: Bearer xxx
    const auth = req.headers.get('authorization');
    const fromHeader = auth?.toLowerCase().startsWith('bearer ')
        ? auth.split(' ')[1]
        : null;

    // 2) หรือจาก query param ?token=...
    const url = new URL(req.url);
    const fromQuery = url.searchParams.get('token');

    const token = fromHeader || fromQuery;
    if (!token || !JWT_SECRET) return null;

    try {
        const payload = jwt.verify(token, JWT_SECRET) as any;
        return payload ? (payload as Me) : null;
    } catch {
        return null;
    }
}

export async function GET(req: Request) {
    const me = authFromReq(req);
    if (!me?.sub) return new NextResponse('UNAUTHORIZED', { status: 401 });

    const headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': FE_ORIGIN,
        'Access-Control-Allow-Credentials': 'true',
        'X-Accel-Buffering': 'no',
    } as const;

    const stream = new ReadableStream({
        start: async (controller) => {
            const enc = new TextEncoder();
            let closed = false;

            const safeEnqueue = (s: string) => {
                if (closed) return;
                try {
                    controller.enqueue(enc.encode(s));
                } catch { /* already closed */ }
            };
            const safeClose = async (client?: any, heartbeat?: any) => {
                if (closed) return;
                closed = true;
                try { clearInterval(heartbeat); } catch { }
                try { client?.off?.('notification', onNotify); } catch { }
                try { await client?.query?.('UNLISTEN noti'); } catch { }
                try { client?.release?.(); } catch { }
                try { controller.close(); } catch { }
            };

            const client = await pool.connect();
            await client.query('LISTEN noti');

            const onNotify = (msg: any) => {
                try {
                    const payload = JSON.parse(msg.payload || '{}');
                    // ส่งเฉพาะ noti ของ user นี้
                    if (payload.userId === me.sub) {
                        safeEnqueue(`data: ${JSON.stringify(payload)}\n\n`);
                    }
                } catch { /* ignore */ }
            };
            // @ts-ignore
            client.on('notification', onNotify);

            // เปิดสตรีม
            safeEnqueue(': connected\n\n');

            // heartbeat กัน proxy ปิด
            const heartbeat = setInterval(() => {
                safeEnqueue('event: ping\ndata: {}\n\n');
            }, 25_000);

            // ปิดเมื่อ client ยกเลิก
            // @ts-ignore
            req.signal?.addEventListener?.('abort', () => { void safeClose(client, heartbeat); }, { once: true });
            // ถ้า db client error
            // @ts-ignore
            client.on?.('error', () => { void safeClose(client, heartbeat); });
        },
    });

    return new Response(stream, { headers });
}

export async function OPTIONS() {
    const res = NextResponse.json({ ok: true });
    res.headers.set('Access-Control-Allow-Origin', FE_ORIGIN);
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    return res;
}
