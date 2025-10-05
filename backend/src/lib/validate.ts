import { z } from 'zod';

export const RegisterSchema = z.object({
  studentId: z.string().trim().min(4),
  password:  z.string().min(8),
  name:      z.string().trim().min(3).max(30).optional()
});

export const LoginSchema = z.object({
  identifier: z.string().trim().min(1), // email / studentId / username
  password:   z.string().min(1)
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput    = z.infer<typeof LoginSchema>;
