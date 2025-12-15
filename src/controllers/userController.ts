import { Request, Response } from 'express';
import { AppDataSource } from '../data-source';
import { CustomerStatus, User } from '../entities/User';
import { sanitizeUser } from '../utils/userUtils';

const userRepository = AppDataSource.getRepository(User);

export const listUsers = async (req: Request, res: Response) => {
  try {
    const users = await userRepository.find({
      relations: ['license'],
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
      relations: ['license'],
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
      relations: ['license'],
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has a license
    if (user.license) {
      return res.status(400).json({
        message: 'Cannot delete user with an active license. Please delete the license first.',
        licenseId: user.license.id,
      });
    }

    await userRepository.remove(user);

    return res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error deleting user' });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    legalName,
    centerName,
    customerStatus,
    contactPerson,
    contactNumber,
    address,
    assignedAgentFullName,
  } = req.body;

  try {
    const user = await userRepository.findOne({
      where: { id },
      relations: ['license'],
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (legalName !== undefined) user.legalName = legalName ?? null;
    if (centerName !== undefined) user.centerName = centerName ?? null;
    if (customerStatus !== undefined) user.customerStatus = customerStatus ?? CustomerStatus.ACTIVATION_REQUEST;
    if (contactPerson !== undefined) user.contactPerson = contactPerson ?? null;
    if (contactNumber !== undefined) user.contactNumber = contactNumber ?? null;
    if (address !== undefined) user.address = address ?? null;
    if (assignedAgentFullName !== undefined) user.assignedAgentFullName = assignedAgentFullName ?? null;

    await userRepository.save(user);

    const updated = await userRepository.findOne({
      where: { id },
      relations: ['license'],
    });

    return res.json(updated ? sanitizeUser(updated) : sanitizeUser(user));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error updating user' });
  }
};
