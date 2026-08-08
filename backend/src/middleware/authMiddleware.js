import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import prisma from '../db.js';
import { AppError } from './errorHandler.js';

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required. Missing token.', 401);
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (err) {
      throw new AppError('Invalid or expired authentication token.', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      throw new AppError('User belonging to this token no longer exists.', 401);
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
