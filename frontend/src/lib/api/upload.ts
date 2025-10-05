// src/lib/api/upload.ts
type MinimalSign = {
    cloudName: string;
    apiKey: string;
    timestamp: number;
    signature: string;
    stringToSign: string; // เผื่อ debug
};

export async function uploadToCloudinaryMinimal(file: File) {
    // 1) ขอ params ที่เซ็นเฉพาะ timestamp
    const sign: MinimalSign = await fetch('/api/images/sign', {
        method: 'POST'
    }).then((r) => r.json());

    // 2) ประกอบ FormData "เฉพาะ" พารามิเตอร์ที่ตรงกับ signature
    const fd = new FormData();
    fd.set('file', file);
    fd.set('api_key', sign.apiKey);
    fd.set('timestamp', String(sign.timestamp));
    fd.set('signature', sign.signature);

    // ❌ ห้ามใส่ค่าอย่าง folder / upload_preset / public_id / use_filename / unique_filename
    // เพราะถ้าใส่ Cloudinary จะเอาไปคิด stringToSign ด้วย แต่เราไม่ได้เซ็น → Mismatch

    const endpoint = `https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`;
    const res = await fetch(endpoint, { method: 'POST', body: fd });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message || 'Cloudinary upload failed');
    return json;
}
