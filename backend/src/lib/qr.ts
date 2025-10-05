// src/lib/qr.ts
export type QRPayload = {
    v?: number;            // version (optional)
    action?: string;       // BUY_REQUEST, MEET_CHECKIN, etc.
    id?: string;           // entity id (listing/offer/txn)
    ref?: string;          // optional reference
    userId?: string;       // optional
    url?: string;          // fallback open url
    exp?: number;          // unix sec
    sig?: string;          // optional signature
    [k: string]: any;
};

export function normalizeAction(s?: string | null): string {
    if (!s) return '';
    const t = String(s).trim().replace(/[\s_-]+/g, '_').toUpperCase();
    const aliases: Record<string, string> = {
        'BUY': 'BUY_REQUEST',
        'BUYREQUEST': 'BUY_REQUEST',
        'BUY_REQUEST': 'BUY_REQUEST',
        'MEET': 'MEET_CHECKIN',
        'MEET_CHECKIN': 'MEET_CHECKIN',
        'MEET_CONFIRM': 'MEET_CONFIRM',
        'PAY': 'PAY_CONFIRM',
        'PAY_CONFIRM': 'PAY_CONFIRM',
        'OFFER_ACCEPT': 'OFFER_ACCEPT',
        'OFFER_ACCEPTED': 'OFFER_ACCEPT',
    };
    return aliases[t] || t;
}

export function parseQR(raw: string): QRPayload | null {
    const s = raw.trim();
    // 1) JSON / base64(json)
    try {
        const j = JSON.parse(s);
        return j && typeof j === 'object' ? (j as QRPayload) : null;
    } catch { }
    try {
        const b = atobSafe(s);
        const j = JSON.parse(b);
        return j && typeof j === 'object' ? (j as QRPayload) : null;
    } catch { }
    // 2) URL → treat as url action
    if (/^https?:\/\//i.test(s)) return { action: 'OPEN_URL', url: s };
    // 3) key=value&... (query-like)
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

function atobSafe(x: string) {
    if (typeof window !== 'undefined' && window.atob) return window.atob(x);
    // Node
    return Buffer.from(x, 'base64').toString('utf8');
}
