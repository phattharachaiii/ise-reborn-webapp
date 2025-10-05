// src/lib/jwt.ts
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export type JwtPayload = {
  uid: string;
  iat?: number;
  exp?: number;
};

import type { SignOptions } from 'jsonwebtoken';

export function signJwt(
  payload: JwtPayload,
  expiresIn: SignOptions['expiresIn'] = '7d'
) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyJwt(token?: string): JwtPayload | null {
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}
