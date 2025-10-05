// app/lib/cloudinary.ts
import crypto from 'crypto';

export const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';
export const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '';
export const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || '';

export function buildMinimalSignedParams() {
    if (!CLOUDINARY_API_SECRET) throw new Error('CLOUDINARY_API_SECRET missing');
    const timestamp = Math.floor(Date.now() / 1000);

    // === เซ็นเฉพาะ timestamp เท่านั้น ===
    const stringToSign = `timestamp=${timestamp}`;
    const signature = crypto
        .createHash('sha1')
        .update(stringToSign + CLOUDINARY_API_SECRET)
        .digest('hex');

    return {
        cloudName: CLOUDINARY_CLOUD_NAME,
        apiKey: CLOUDINARY_API_KEY,
        timestamp,
        signature,
        stringToSign
    };
}
