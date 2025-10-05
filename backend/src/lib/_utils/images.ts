// app/api/_utils/images.ts
export function normArray(v: unknown): string[] {
    if (Array.isArray(v)) return v.filter((s): s is string => typeof s === 'string' && !!s.trim());
    if (typeof v === 'string') {
        const s = v.trim(); if (!s) return [];
        if ((s.startsWith('[') && s.endsWith(']')) || s.startsWith('["')) {
            try {
                const arr = JSON.parse(s);
                if (Array.isArray(arr)) return arr.filter((x: unknown): x is string => typeof x === 'string' && !!x.trim());
            } catch { }
        }
        return s.split(',').map(x => x.trim()).filter(Boolean);
    }
    return [];
}

export function deriveImageUrls(l: any): string[] {
    const out: string[] = [];
    out.push(...normArray(l?.imageUrls)); // ฟิลด์ใหม่
    out.push(...normArray(l?.images));    // ฟิลด์เก่า/สำรอง
    const singles = [l?.imageUrl, l?.coverUrl, l?.thumbnailUrl, l?.image, l?.cover, l?.photoUrl];
    for (const s of singles) if (typeof s === 'string' && s.trim()) out.push(s.trim());
    return Array.from(new Set(out)); // uniq + keep order
}

export function withImageUrls<T extends Record<string, any>>(obj: T): T & { imageUrls: string[] } {
    return { ...obj, imageUrls: deriveImageUrls(obj) };
}

export function withImageUrlsList<T extends Record<string, any>>(arr: T[]): (T & { imageUrls: string[] })[] {
    return arr.map(withImageUrls);
}
