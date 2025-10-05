export function withAvatarBuster(url?: string, seed?: number | string) {
    if (!url) return '';
    const q = typeof seed !== 'undefined' ? String(seed) : String(Date.now());
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}t=${q}`;
}
