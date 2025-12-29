import jwt from 'jsonwebtoken'
import { UserRole } from '../entities/User'

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key' // In production, always use env var

export interface TokenPayload {
  userId: string
  role: UserRole
}

export const signToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' })
}

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_SECRET) as TokenPayload
}
