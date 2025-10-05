import { ApiError } from './http';

// สร้าง helper โยน error ที่อ่านง่าย
export const badJson = () => new ApiError(400, 'BAD_JSON', 'ข้อมูล JSON ไม่ถูกต้อง');
export const missingFields = (fields: string[]) =>
    new ApiError(400, 'MISSING_FIELDS', `กรอกข้อมูลไม่ครบ: ${fields.join(', ')}`);
export const invalidCred = () => new ApiError(401, 'INVALID_CREDENTIALS', 'อีเมล/ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
export const forbidden = () => new ApiError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์เข้าถึง');
export const duplicate = (what: string) => new ApiError(409, `DUPLICATE_${what}`, `${what} นี้ถูกใช้แล้ว`);
export const tooShortPwd = () => new ApiError(400, 'PASSWORD_TOO_SHORT', 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร');

// Prisma unique violation → ระบุ field
export function mapPrismaError(e: unknown) {
    const any = e as { code?: string; meta?: any };
    if (any?.code === 'P2002') {
        const target = Array.isArray(any.meta?.target) ? any.meta?.target[0] : any.meta?.target;
        if (target) return duplicate(String(target).toUpperCase());
        return duplicate('RESOURCE');
    }
    return e;
}
