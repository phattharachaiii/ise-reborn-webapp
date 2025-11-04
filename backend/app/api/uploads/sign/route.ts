// app/api/uploads/sign/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs';

const FE_ORIGIN = process.env.FE_ORIGIN || 'http://localhost:5173';

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME!;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY!;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET!;
const CLOUDINARY_UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET || ''; // (ถ้าใช้ preset แบบ "Signed")

function withCORS(res: NextResponse) {
    res.headers.set('Access-Control-Allow-Origin', FE_ORIGIN);
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.headers.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    return res;
}

export async function OPTIONS() {
    return withCORS(new NextResponse(null, { status: 204 }));
}

/**
 * สร้างลายเซ็นแบบ Cloudinary:
 * - รวมเฉพาะพารามิเตอร์ที่ถูกส่งไปยัง Cloudinary (ยกเว้น file, api_key, resource_type)
 * - เรียง key ตามตัวอักษร
 * - ต่อเป็น "k1=v1&k2=v2..." + API_SECRET แล้วทำ sha1
 */
function signCloudinaryParams(params: Record<string, any>, apiSecret: string) {
    const toSign: string[] = [];
    const keys = Object.keys(params)
        .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
        .sort();

    for (const k of keys) {
        toSign.push(`${k}=${params[k]}`);
    }
    const base = toSign.join('&') + apiSecret;
    return crypto.createHash('sha1').update(base).digest('hex');
}

export async function POST(req: Request) {
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
        return withCORS(
            NextResponse.json({ message: 'CLOUDINARY env is missing' }, { status: 500 })
        );
    }

    const body = await req.json().catch(() => ({} as any));

    // ถ้าจะบังคับใช้ preset ที่เซิร์ฟเวอร์กำหนด ก็ใช้ตัวแปร env ด้านล่าง
    // หรือปล่อยให้ client ส่งมาก็ได้ (แต่สิ่งที่ client ส่ง ต้องถูกเซ็นรวม)
    const upload_preset: string =
        (body.upload_preset && String(body.upload_preset)) || CLOUDINARY_UPLOAD_PRESET || '';

    const folder: string | undefined = body.folder ? String(body.folder) : undefined;
    const public_id: string | undefined = body.public_id ? String(body.public_id) : undefined;
    const context: string | undefined = body.context ? String(body.context) : undefined;
    const tags: string | undefined = body.tags ? String(body.tags) : undefined;

    // timestamp ใหม่ทุกครั้ง
    const timestamp = Math.floor(Date.now() / 1000);

    // ⚠️ สำคัญ: ต้อง “เซ็นฟิลด์เดียวกับที่จะส่งขึ้น Cloudinary” เท่านั้น
    const paramsToSign: Record<string, any> = {
        timestamp,
        // ถ้าใช้ preset แบบ Signed ต้องใส่ลงในลายเซ็นด้วย
        ...(upload_preset ? { upload_preset } : {}),
        ...(folder ? { folder } : {}),
        ...(public_id ? { public_id } : {}),
        ...(context ? { context } : {}),
        ...(tags ? { tags } : {}),
    };

    const signature = signCloudinaryParams(paramsToSign, CLOUDINARY_API_SECRET);

    return withCORS(
        NextResponse.json({
            cloudName: CLOUDINARY_CLOUD_NAME,
            apiKey: CLOUDINARY_API_KEY,
            timestamp,
            signature,
            uploadPreset: upload_preset || undefined, // ส่งกลับให้ client ใช้ตามนี้เท่านั้น
            folder: folder || undefined,
            public_id: public_id || undefined,
        })
    );
}
