import { Request, Response, NextFunction } from 'express'
import { UserRole } from '../entities/User'

export const roleGuard = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    if (!roles.includes(user.role)) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    next()
  }
}
