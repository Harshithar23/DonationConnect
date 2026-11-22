import { Router } from 'express';
import { authenticate, allowRoles } from '../middleware/auth.js';
import User from '../models/User.js';
import NGO from '../models/NGO.js';
import DonationRequest from '../models/DonationRequest.js';
import Donation from '../models/Donation.js';
import { z } from 'zod';
const router = Router();
router.use(authenticate, allowRoles('admin'));
router.get('/overview', async (req, res, next) => {
  try {
    const [users, userRoles, ngosPending, ngosApproved, requestsPending, donations, donationTotals] = await Promise.all([
      User.countDocuments(),
      User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
      NGO.countDocuments({ verificationStatus: { $in: ['pending','under_review'] } }),
      NGO.countDocuments({ verificationStatus: 'approved' }),
      DonationRequest.countDocuments({ status: 'pending' }),
      Donation.countDocuments(),
      Donation.aggregate([
        { $match: { status: 'pledged' } },
        { $group: { _id: '$type', count: { $sum: 1 }, amount: { $sum: { $cond: [{ $eq: ['$type', 'money'] }, { $ifNull: ['$amount', 0] }, 0] } } } }
      ])
    ]);
    const roles = ['individual', 'company', 'organization', 'ngo', 'admin'];
    const usersByRole = Object.fromEntries(roles.map(role => [role, userRoles.find(item => item._id === role)?.count || 0]));
    const pledged = Object.fromEntries(donationTotals.map(item => [item._id, item]));
    res.json({
      metrics: {
        users,
        usersByRole,
        ngosPending,
        ngosApproved,
        requestsPending,
        donations,
        moneyPledges: { count: pledged.money?.count || 0, amountINR: pledged.money?.amount || 0 },
        goodsPledges: pledged.goods?.count || 0
      }
    });
  } catch(e) { next(e); }
});
router.get('/users', async (req, res, next) => { try { const users = await User.find().select('name email role status createdAt').sort({ createdAt: -1 }).limit(250); res.json({ users }); } catch(e) { next(e); } });
router.patch('/users/:id/status', async (req, res, next) => {
  try {
    const parsed = z.object({ status: z.enum(['active', 'suspended']) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid account status.', details: parsed.error.issues });
    if (req.params.id === req.user._id.toString()) return res.status(400).json({ message: 'You cannot change your own account status.' });
    const current = await User.findById(req.params.id);
    if (!current) return res.status(404).json({ message: 'User not found.' });
    if (current.status === parsed.data.status) return res.json({ user: current });
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, status: current.status },
      { $set: { status: parsed.data.status }, $inc: { tokenVersion: 1 } },
      { new: true, runValidators: true }
    ).select('name email role status');
    if (!user) return res.status(409).json({ message: 'Account status changed while processing this update. Refresh and retry.' });
    res.json({ user });
  } catch(e) { next(e); }
});
export default router;
