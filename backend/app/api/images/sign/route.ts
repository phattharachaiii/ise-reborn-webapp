// app/api/images/sign/route.ts
import { NextResponse } from 'next/server';
import { buildMinimalSignedParams } from '@/lib/cloudinary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FE_ORIGIN = process.env.FE_ORIGIN || 'http://localhost:5173';

function withCORS(res: NextResponse, methods: string[]) {
    res.headers.set('Access-Control-Allow-Origin', FE_ORIGIN);
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    res.headers.set('Access-Control-Allow-Methods', [...methods, 'OPTIONS'].join(','));
    // อนุญาต header ที่เราจะใช้จริง
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    // ช่วยให้ CDN/พร็อกซีแคชตาม Origin ได้ถูก
    res.headers.set('Vary', 'Origin');
    // กัน cache ค่าเซ็นเก่า
    res.headers.set('Cache-Control', 'no-store');
    return res;
}

export async function OPTIONS() {
    // ⚠️ ต้องใส่ CORS headers ใน OPTIONS ด้วย
    const res = new NextResponse(null, { status: 204 });
    return withCORS(res, ['POST']);
}

export async function POST() {
    const signed = buildMinimalSignedParams();
    // debug ชั่วคราว (ลบได้ภายหลัง)
    // console.log('[CLD SIGN]', signed.stringToSign, signed.signature);

    const res = NextResponse.json(
        {
            cloudName: signed.cloudName,
            apiKey: signed.apiKey,
            timestamp: signed.timestamp,
            signature: signed.signature,
            stringToSign: signed.stringToSign, // เผื่อ debug
        },
        { status: 200 }
    );
    return withCORS(res, ['POST']);
}
