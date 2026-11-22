import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Authentication required.' });
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
  try {
    const user = await User.findById(payload.sub).select('-passwordHash');
    if (!user || user.status === 'suspended' || payload.ver !== (user.tokenVersion ?? 0)) {
      return res.status(401).json({ message: 'Account unavailable.' });
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export const allowRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ message: 'You do not have permission to perform this action.' });
  next();
};
