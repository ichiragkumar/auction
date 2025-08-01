import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { logger } from '../config/logger';

export class AuthController {
  async register(req: Request, res: Response) {
    try {
      const { email, password, name, role } = req.body;

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists' });
      }


      const user = await User.create({
        email,
        password,
        name,
        role: role || 'user'
      });


      const token = jwt.sign(
        { userId: user._id, role: user.role },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '24h' }
      );

      res.status(201).json({
        success: true,
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });
    } catch (error) {
      logger.error('Registration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;


      const user = await User.findOne({ email, isActive: true });
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }


      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }


      const token = jwt.sign(
        { userId: user._id, role: user.role },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}