// ตัวช่วยตอบ JSON มาตรฐานและสร้าง Error ที่มี code/status/message
export type ApiErrorShape = {
    ok: false;
    code: string;         // เช่น BAD_JSON, MISSING_FIELDS, DUPLICATE_STUDENT_ID
    message: string;      // ข้อความอ่านง่าย
    details?: unknown;    // ข้อมูลเสริม (เช่น field ที่ผิด)
};

export type ApiSuccessShape<T> = { ok: true } & T;

export class ApiError extends Error {
    status: number;
    code: string;
    details?: unknown;
    constructor(status: number, code: string, message: string, details?: unknown) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
    return Response.json({ ok: true, ...data } as ApiSuccessShape<T>, { status: 200, ...init });
}

export function jsonErr(err: ApiError | unknown) {
    if (err instanceof ApiError) {
        return Response.json(
            { ok: false, code: err.code, message: err.message, details: err.details } as ApiErrorShape,
            { status: err.status }
        );
    }
    // fallback 500
    return Response.json(
        { ok: false, code: 'INTERNAL_ERROR', message: 'เกิดข้อผิดพลาดภายในระบบ' } as ApiErrorShape,
        { status: 500 }
    );
}
