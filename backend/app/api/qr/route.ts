// app/api/qr/route.ts
import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';

const FE_ORIGIN = process.env.FE_ORIGIN || 'http://localhost:5173';
const QR_SECRET = process.env.QR_SECRET || '';         // ถ้าไม่ได้ใช้ลายเซ็น ปล่อยว่างได้
const QR_DEBUG = String(process.env.QR_DEBUG || 'false').toLowerCase() === 'true';

function withCORS(res: NextResponse, methods: string[] = ['POST']) {
    res.headers.set('Access-Control-Allow-Origin', FE_ORIGIN);
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.headers.set('Access-Control-Allow-Methods', [...methods, 'OPTIONS'].join(','));
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    res.headers.set('Cache-Control', 'no-store');
    res.headers.set('Vary', 'Origin');
    return res;
}

export async function OPTIONS() {
    return withCORS(new NextResponse(null, { status: 204 }), ['POST']);
}

type QRPayload = {
    v?: number;
    action?: string;
    id?: string;
    ref?: string;
    userId?: string;
    url?: string;
    exp?: number;
    sig?: string;
    // legacy keys (old QR formats)
    type?: string;
    act?: string;
    a?: string;
    actionType?: string;
    targetId?: string;
    listingId?: string;
    offerId?: string;
    [k: string]: any;
};

export async function POST(req: Request) {
    const me = await getUserFromRequest(req).catch(() => null);
    const body = await req.json().catch(() => ({}));
    const raw = String(body?.code ?? body?.qr ?? body?.q ?? '').trim();
    if (!raw) return withCORS(NextResponse.json({ message: 'CODE_REQUIRED' }, { status: 400 }), ['POST']);

    const payload = parseQRCompat(raw);
    if (QR_DEBUG) console.log('[QR] raw=', raw, 'parsed=', payload);

    if (!payload) {
        return withCORS(NextResponse.json({ message: 'INVALID_QR' }, { status: 400 }), ['POST']);
    }

    // ---- normalize (backward-compatible) ----
    const norm = normalizePayload(payload);
    if (QR_DEBUG) console.log('[QR] normalized=', norm);

    // exp (optional)
    const now = Math.floor(Date.now() / 1000);
    if (norm.exp && now > Number(norm.exp)) {
        return withCORS(NextResponse.json({ message: 'QR_EXPIRED' }, { status: 410 }), ['POST']);
    }

    // signature (optional)
    if (QR_SECRET && !verifySig(norm)) {
        return withCORS(NextResponse.json({ message: 'INVALID_SIGNATURE' }, { status: 401 }), ['POST']);
    }

    // ---- router ----
    // รองรับ OPEN_URL เสมอ
    if (norm.action === 'OPEN_URL' && norm.url) {
        return withCORS(NextResponse.json({ ok: true, action: 'OPEN_URL', url: norm.url }, { status: 200 }), ['POST']);
    }

    switch (norm.action) {
        case 'BUY_REQUEST': {
            if (!me) return withCORS(NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 }), ['POST']);
            const id = norm.id || norm.listingId;
            if (!id) return withCORS(NextResponse.json({ message: 'MISSING_ID' }, { status: 400 }), ['POST']);
            return withCORS(NextResponse.json({ ok: true, action: 'BUY_REQUEST', nextUrl: `/offers/new?listing=${id}` }, { status: 200 }), ['POST']);
        }
        case 'OFFER_ACCEPT': {
            if (!me) return withCORS(NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 }), ['POST']);
            const id = norm.id || norm.offerId;
            if (!id) return withCORS(NextResponse.json({ message: 'MISSING_ID' }, { status: 400 }), ['POST']);
            return withCORS(NextResponse.json({ ok: true, action: 'OFFER_ACCEPT', nextUrl: `/offers/${id}` }, { status: 200 }), ['POST']);
        }
        case 'MEET_CHECKIN': {
            if (!me) return withCORS(NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 }), ['POST']);
            const id = norm.id;
            if (!id) return withCORS(NextResponse.json({ message: 'MISSING_ID' }, { status: 400 }), ['POST']);
            return withCORS(NextResponse.json({ ok: true, action: 'MEET_CHECKIN', nextUrl: `/meet/${id}/checkin` }, { status: 200 }), ['POST']);
        }
        case 'MEET_CONFIRM': {
            if (!me) return withCORS(NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 }), ['POST']);
            const id = norm.id;
            if (!id) return withCORS(NextResponse.json({ message: 'MISSING_ID' }, { status: 400 }), ['POST']);
            return withCORS(NextResponse.json({ ok: true, action: 'MEET_CONFIRM', nextUrl: `/meet/${id}/confirm` }, { status: 200 }), ['POST']);
        }
        case 'PAY_CONFIRM': {
            if (!me) return withCORS(NextResponse.json({ message: 'UNAUTHORIZED' }, { status: 401 }), ['POST']);
            const id = norm.id;
            if (!id) return withCORS(NextResponse.json({ message: 'MISSING_ID' }, { status: 400 }), ['POST']);
            return withCORS(NextResponse.json({ ok: true, action: 'PAY_CONFIRM', nextUrl: `/pay/${id}/confirm` }, { status: 200 }), ['POST']);
        }
        default: {
            // 🔁 Fallback แบบ “เดาเจตนา” สำหรับ QR เก่า:
            // - ถ้ามี listingId ⇒ BUY_REQUEST
            // - ถ้ามี offerId   ⇒ OFFER_ACCEPT
            // - ถ้ามี url       ⇒ OPEN_URL
            if (norm.listingId) {
                return withCORS(NextResponse.json({ ok: true, action: 'BUY_REQUEST', nextUrl: `/offers/new?listing=${norm.listingId}` }, { status: 200 }), ['POST']);
            }
            if (norm.offerId) {
                return withCORS(NextResponse.json({ ok: true, action: 'OFFER_ACCEPT', nextUrl: `/offers/${norm.offerId}` }, { status: 200 }), ['POST']);
            }
            if (norm.url) {
                return withCORS(NextResponse.json({ ok: true, action: 'OPEN_URL', url: norm.url }, { status: 200 }), ['POST']);
            }
            return withCORS(
                NextResponse.json({
                    message: 'UNKNOWN_ACTION',
                    received: payload.action ?? payload.type ?? payload.act ?? payload.a ?? '',
                    normalized: norm.action,
                    supported: ['BUY_REQUEST', 'OFFER_ACCEPT', 'MEET_CHECKIN', 'MEET_CONFIRM', 'PAY_CONFIRM', 'OPEN_URL'],
                    hint: 'รองรับคีย์ action เดิม: action/type/act/a/actionType และ URL ที่มี ?action=...'
                }, { status: 400 }),
                ['POST']
            );
        }
    }
}

/* ---------------- helpers ---------------- */

function parseQRCompat(raw: string): QRPayload | null {
    const s = raw.trim();

    // 1) JSON ตรง ๆ
    try {
        const j = JSON.parse(s);
        if (j && typeof j === 'object') return j as QRPayload;
    } catch { }

    // 2) base64 หรือ base64url ของ JSON
    try {
        const b = base64AnyToString(s);
        const j = JSON.parse(b);
        if (j && typeof j === 'object') return j as QRPayload;
    } catch { }

    // 3) URL: อาจมีพารามิเตอร์ action,id,... อยู่ใน query
    if (/^https?:\/\//i.test(s)) {
        try {
            const u = new URL(s);
            const obj: QRPayload = { url: s };
            // ดึงพารามิเตอร์ที่อาจใช้
            const keys = ['action', 'type', 'act', 'a', 'actionType', 'id', 'ref', 'userId', 'listingId', 'offerId', 'exp', 'sig'];
            for (const k of keys) {
                const v = u.searchParams.get(k);
                if (v !== null) (obj as any)[k] = v;
            }
            // เผื่อมี path บอกชนิด เช่น /qr/buy-request/:id
            const pathSeg = u.pathname.split('/').filter(Boolean);
            const maybeAct = pathSeg[1] || pathSeg[0]; // ยืดหยุ่น
            if (!obj.action && maybeAct) obj.action = maybeAct;
            // ดึง id จาก path ถ้ามี
            const last = pathSeg[pathSeg.length - 1];
            if (!obj.id && last && /^[a-z0-9]{8,}$/i.test(last)) obj.id = last;
            return obj;
        } catch { }
    }

    // 4) key=value&key2=... (legacy kv)
    if (s.includes('=')) {
        const obj: Record<string, string> = {};
        for (const part of s.split('&')) {
            const [k, v = ''] = part.split('=');
            obj[decodeURIComponent(k)] = decodeURIComponent(v);
        }
        return obj as QRPayload;
    }

    return null;
}

function normalizeAction(s?: string | null): string {
    if (!s) return '';
    const t = String(s).trim().replace(/[\s_-]+/g, '_').toUpperCase();
    const aliases: Record<string, string> = {
        BUY: 'BUY_REQUEST',
        BUYREQUEST: 'BUY_REQUEST',
        BUY_REQUEST: 'BUY_REQUEST',
        OFFER: 'OFFER_ACCEPT',
        OFFER_ACCEPTED: 'OFFER_ACCEPT',
        MEET: 'MEET_CHECKIN',
        MEET_CHECKIN: 'MEET_CHECKIN',
        MEET_CONFIRM: 'MEET_CONFIRM',
        PAY: 'PAY_CONFIRM',
        PAY_CONFIRM: 'PAY_CONFIRM',
        OPEN: 'OPEN_URL',
        OPEN_URL: 'OPEN_URL'
    };
    return aliases[t] || t;
}

function normalizePayload(p: QRPayload) {
    const action = normalizeAction(p.action ?? p.type ?? p.act ?? p.a ?? p.actionType);
    const id = p.id ?? p.targetId ?? p.listingId ?? p.offerId ?? '';
    const out = { ...p, action, id };

    // ถ้า action ว่าง แต่ url มี query ?action=...
    if (!action && p.url) {
        try {
            const u = new URL(p.url);
            out.action = normalizeAction(u.searchParams.get('action'));
            out.id = out.id || u.searchParams.get('id') || '';
        } catch { }
    }
    return out as QRPayload & { action: string; id?: string };
}

function verifySig(p: QRPayload): boolean {
    if (!QR_SECRET) return true;
    if (!p.sig) return false;
    const base = [p.v ?? 1, normalizeAction(p.action || ''), p.id || '', p.ref || '', p.userId || '', p.exp || ''].join('|');
    const crypto = require('crypto');
    const h = crypto.createHmac('sha256', QR_SECRET).update(base).digest('hex');
    return h === p.sig;
}

function base64AnyToString(s: string) {
    // รองรับ base64url
    const norm = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
    if (typeof Buffer !== 'undefined') return Buffer.from(norm, 'base64').toString('utf8');
    // @ts-ignore
    return atob(norm);
}
