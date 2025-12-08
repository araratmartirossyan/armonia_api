import { Request, Response } from 'express';
import { AppDataSource } from '../data-source';
import { User, UserRole } from '../entities/User';
import bcrypt from 'bcryptjs';
import { signToken } from '../utils/jwt';
import { License } from '../entities/License';

const userRepository = AppDataSource.getRepository(User);
const licenseRepository = AppDataSource.getRepository(License);

export const register = async (req: Request, res: Response) => {
  const { email, password, role } = req.body;

  try {
    const existingUser = await userRepository.findOneBy({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = userRepository.create({
      email,
      password: hashedPassword,
      role: role || UserRole.CUSTOMER,
    });

    await userRepository.save(user);

    const token = signToken({ userId: user.id, role: user.role });
    return res.status(201).json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const login = async ({ body: { email, password } }: Request, res: Response) => {
  try {
    const user = await userRepository.findOneBy({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const license = await licenseRepository.findOneBy({ user: { id: user.id } });

    if (!license) {
      return res.status(401).json({ message: 'License not found' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = signToken({ userId: user.id, role: user.role });
    return res.json({ token, user: { id: user.id, email: user.email, role: user.role }, license: license?.key });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
