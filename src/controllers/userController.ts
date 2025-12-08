import { Request, Response } from 'express';
import { AppDataSource } from '../data-source';
import { User } from '../entities/User';
import { sanitizeUser } from '../utils/userUtils';

const userRepository = AppDataSource.getRepository(User);

export const listUsers = async (req: Request, res: Response) => {
  try {
    const users = await userRepository.find({
      relations: ['licenses'],
      order: { createdAt: 'DESC' },
    });

    // Sanitize all users (remove passwords)
    const sanitizedUsers = users.map((user) => sanitizeUser(user));

    return res.json(sanitizedUsers);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error listing users' });
  }
};

export const getUser = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const user = await userRepository.findOne({
      where: { id },
      relations: ['licenses'],
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json(sanitizeUser(user));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error fetching user' });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUser = req.user;

  try {
    // Prevent self-deletion
    if (currentUser && currentUser.userId === id) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    const user = await userRepository.findOne({
      where: { id },
      relations: ['licenses'],
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has licenses
    if (user.licenses && user.licenses.length > 0) {
      return res.status(400).json({
        message: `Cannot delete user with ${user.licenses.length} active license(s). Please delete or reassign licenses first.`,
      });
    }

    await userRepository.remove(user);

    return res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error deleting user' });
  }
};
