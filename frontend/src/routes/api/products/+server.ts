import type { RequestHandler } from '@sveltejs/kit';
export const GET: RequestHandler = async () => {
    await new Promise((r) => setTimeout(r, 200));
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
