export function normalizeDomain(email: string) {
    try {
        const at = email.split('@')[1] || '';
        return at.trim().toLowerCase();
    } catch {
        return '';
    }
}

export function isEmailAllowed(email: string) {
    const domain = normalizeDomain(email);
    const allowRaw = process.env.ALLOWED_EMAIL_DOMAINS || '';
    if (!allowRaw) return true; // ไม่ตั้งค่า = อนุญาตทุกโดเมน (ใช้ตอน dev)
    const whitelist = allowRaw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    return whitelist.includes(domain);
}
