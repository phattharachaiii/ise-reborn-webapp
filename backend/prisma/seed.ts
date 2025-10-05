// backend/prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    // กำหนดค่าแอดมินเริ่มต้นที่ต้องการ
    const studentId = '66050947';
    const email = `${studentId}@kmitl.ac.th`;
    const name = 'adminzoom';               // ชื่อผู้ใช้แอดมิน
    const passwordHash = await bcrypt.hash('admin2547', 10);

    // ถ้ามีผู้ใช้นี้แล้ว → อัปเดต role/pw, ถ้าไม่มี → สร้างใหม่
    await prisma.user.upsert({
        where: { studentId },
        update: { role: 'ADMIN', email, name, passwordHash, accountStatus: 'ACTIVE' },
        create: { studentId, email, name, passwordHash, role: 'ADMIN', accountStatus: 'ACTIVE' }
    });

    console.log('✅ admin ready:', studentId);
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
