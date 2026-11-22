import { Router } from 'express';
import { z } from 'zod';
import Donation from '../models/Donation.js';
import NGO from '../models/NGO.js';
import DonationRequest from '../models/DonationRequest.js';
import { authenticate, allowRoles } from '../middleware/auth.js';
import { canTransitionDonation } from '../services/donationLifecycle.js';
import { notifyDonationCreated, notifyDonationReceived } from '../services/emailService.js';
const router = Router();
export const moneyDonationAmountSchema = z.number().int().min(1000).max(10000).refine(amount => amount % 1000 === 0, 'Choose an amount from ₹1,000 to ₹10,000 in ₹1,000 increments.');
const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'A valid MongoDB ID is required.');
const schema = z.object({ ngoId: objectIdSchema, requestId: objectIdSchema.optional(), type: z.enum(['money','goods']), amount: moneyDonationAmountSchema.optional(), items: z.array(z.object({ name: z.string().trim().min(1).max(100), quantity: z.number().int().min(1), unit: z.string().trim().min(1).max(30).optional(), estimatedValue: z.number().min(0).optional() })).min(1).max(100).optional(), pickup: z.object({ donorName: z.string().trim().min(2).max(120), phone: z.string().trim().min(5).max(25), address: z.string().trim().min(5).max(500), city: z.string().trim().min(1).max(100), state: z.string().trim().min(1).max(100), postalCode: z.string().trim().min(3).max(15), preferredDate: z.string().datetime().optional(), notes: z.string().trim().max(1000).optional() }).optional() }).superRefine((data, context) => {
  if (data.type === 'money' && data.amount === undefined) context.addIssue({ code: 'custom', message: 'Money pledges require an amount.', path: ['amount'] });
  if (data.type === 'money' && (data.items || data.pickup)) context.addIssue({ code: 'custom', message: 'Money pledges cannot include goods or pickup details.', path: ['type'] });
  if (data.type === 'goods' && data.amount !== undefined) context.addIssue({ code: 'custom', message: 'Goods pledges cannot include a money amount.', path: ['amount'] });
  if (data.type === 'goods' && (!data.items?.length || !data.pickup)) context.addIssue({ code: 'custom', message: 'Goods pledges require items and pickup details.', path: ['items'] });
});
const secureReceiptUrl = z.string().url().refine(url => url.toLowerCase().startsWith('https://'), 'Receipt URLs must use HTTPS.');
const trackingSchema = z.object({
  status: z.enum(['pickup_scheduled', 'collected', 'received', 'completed', 'disputed', 'cancelled']),
  note: z.string().trim().min(3).max(1000),
  receiptUrl: secureReceiptUrl.optional()
}).refine(data => data.status !== 'completed' || data.receiptUrl, { message: 'A secure receipt reference is required to complete a goods donation.', path: ['receiptUrl'] });
router.post('/', authenticate, allowRoles('individual','company','organization'), async (req, res, next) => {
  try {
    const data = schema.parse(req.body);
    if (data.type === 'money' && req.user.role !== 'individual') return res.status(403).json({ message: 'Only individual donor accounts can make money donations.' });
    if (data.type === 'goods' && req.user.role === 'individual') return res.status(403).json({ message: 'Goods donations are available to company and organization accounts.' });
    if (data.type === 'goods' && (!data.items?.length || !data.pickup?.address)) return res.status(400).json({ message: 'Goods donations require an eligible organization account, item list and pickup address.' });

    const ngo = await NGO.findOne({ _id: data.ngoId, verificationStatus: 'approved' });
    if (!ngo) return res.status(404).json({ message: 'Verified NGO not found.' });

    let request = null;
    if (data.requestId) {
      request = await DonationRequest.findOne({ _id: data.requestId, ngo: ngo._id, deletedAt: { $exists: false } });
      if (!request) return res.status(400).json({ message: 'Donation request not found for this NGO.' });
      if (request.deadline && request.deadline <= new Date()) return res.status(409).json({ message: 'This donation request has expired.' });
      if (request.status === 'reserved') return res.status(409).json({ message: 'Another donor has already pledged to this need.' });
      if (request.status !== 'approved') return res.status(400).json({ message: 'This donation request is no longer accepting pledges.' });
      if (request.donationType !== 'both' && request.donationType !== data.type) return res.status(400).json({ message: `This request accepts ${request.donationType} donations only.` });
      request = await DonationRequest.findOneAndUpdate(
        { _id: request._id, status: 'approved' },
        { $set: { status: 'reserved' } },
        { new: true }
      );
      if (!request) return res.status(409).json({ message: 'Another donor has already pledged to this need.' });
    }

    const donation = new Donation({
      donor: req.user._id,
      ngo: ngo._id,
      request: request?._id,
      type: data.type,
      amount: data.type === 'money' ? data.amount : undefined,
      items: data.items,
      payment: {
        method: data.type === 'money' ? 'pledge_only' : 'not_applicable',
        verificationStatus: 'not_required'
      },
      pickup: data.pickup ? { ...data.pickup, preferredDate: data.pickup.preferredDate ? new Date(data.pickup.preferredDate) : undefined } : undefined,
      status: 'pledged',
      tracking: [{ status: 'pledged', note: data.type === 'money' ? 'Money pledge recorded; no payment was processed.' : 'Goods pledge recorded.', actor: req.user._id }]
    });

    try {
      await donation.save();
    } catch (error) {
      if (request) {
        const rollback = await DonationRequest.updateOne(
          { _id: request._id, status: 'reserved' },
          { $set: { status: 'approved' } }
        );
        if (rollback.modifiedCount !== 1) {
          throw new Error('Donation creation failed and the need reservation could not be released.');
        }
      }
      throw error;
    }

    notifyDonationCreated({ user: req.user, donation: { ...donation.toObject(), request } });
    res.status(201).json({ donation });
  } catch(e) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: 'Invalid donation data.', details: e.issues });
    next(e);
  }
});
router.get('/mine', authenticate, async (req, res, next) => { try { let filter = { donor: req.user._id }; if (req.user.role === 'ngo') { const ngo = await NGO.findOne({ user: req.user._id }); filter = { ngo: ngo?._id }; } if (req.user.role === 'admin') filter = {}; const donations = await Donation.find(filter).populate('donor','name email').populate('ngo','legalName').populate('request','title').sort({ createdAt: -1 }).limit(200); res.json({ donations }); } catch(e) { next(e); } });
router.get('/:id', authenticate, async (req, res, next) => { try { const d = await Donation.findById(req.params.id).populate('donor','name email phone').populate('ngo','legalName').populate('request','title'); if (!d) return res.status(404).json({ message: 'Donation not found.' }); const ngo = d.ngo?._id?.toString(); const ownerNGO = req.user.role === 'ngo' ? (await NGO.findOne({ user: req.user._id }))?._id?.toString() : null; if (req.user.role !== 'admin' && d.donor._id.toString() !== req.user._id.toString() && ngo !== ownerNGO) return res.status(403).json({ message: 'Not allowed to view this donation.' }); res.json({ donation: d }); } catch(e) { next(e); } });
router.patch('/:id/tracking', authenticate, allowRoles('ngo'), async (req, res, next) => {
  try {
    const parsed = trackingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid tracking update.', details: parsed.error.issues });
    const { status, note, receiptUrl } = parsed.data;
    const d = await Donation.findById(req.params.id).populate('donor', 'email name');
    if (!d) return res.status(404).json({ message: 'Donation not found.' });
    const ngo = await NGO.findOne({ user: req.user._id, verificationStatus: 'approved' });
    if (!ngo) return res.status(403).json({ message: 'Only approved NGOs can update donation tracking.' });
    if (d.ngo.toString() !== ngo._id.toString()) return res.status(403).json({ message: 'This donation belongs to another NGO.' });
    if (!canTransitionDonation(d.type, d.status, status)) {
      return res.status(409).json({ message: `Cannot change a ${d.type} donation from ${d.status} to ${status}.` });
    }
    const update = {
      $set: { status, ...(receiptUrl ? { receiptUrl } : {}) },
      $push: { tracking: { status, note, actor: req.user._id } }
    };
    const updated = await Donation.findOneAndUpdate(
      { _id: d._id, status: d.status },
      update,
      { new: true, runValidators: true }
    ).populate('donor', 'email name').populate('ngo', 'legalName').populate('request', 'title');
    if (!updated) return res.status(409).json({ message: 'Donation status changed while processing this update. Refresh and try again.' });
    if (status === 'completed' && updated.request) {
      await DonationRequest.updateOne(
        { _id: updated.request, status: { $in: ['approved', 'reserved'] } },
        { $set: { status: 'fulfilled' } }
      );
    }
    if (status === 'received') notifyDonationReceived({ user: updated.donor, donation: updated });
    res.json({ donation: updated });
  } catch(e) { next(e); }
});
export default router;
