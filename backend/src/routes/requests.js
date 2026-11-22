import { Router } from 'express';
import { z } from 'zod';
import DonationRequest from '../models/DonationRequest.js';
import NGO from '../models/NGO.js';
import { authenticate, allowRoles } from '../middleware/auth.js';
import { requestEmailReview } from '../services/requestReview.js';
import { canAdminReviewRequest } from '../services/requestLifecycle.js';
const router = Router();
const requestSchema = z.object({ title: z.string().trim().min(5).max(140), description: z.string().trim().min(20).max(3000), category: z.enum(['food','clothing','education','medical','shelter','other']), donationType: z.enum(['money','goods','both']), targetAmount: z.number().min(0).optional(), goodsNeeded: z.array(z.object({ item: z.string().trim().min(1).max(100), quantity: z.number().int().min(1), unit: z.string().trim().min(1).max(30).optional() })).max(100).optional(), location: z.object({ city: z.string().trim().min(1).max(100), state: z.string().trim().min(1).max(100), address: z.string().trim().min(5).max(500) }), deadline: z.string().datetime().refine(value => new Date(value) > new Date(), 'Deadline must be in the future.').optional(), imageUrl: z.string().url().optional() });
const publicRequestFields = 'title description category donationType targetAmount amountRaised goodsNeeded location.city location.state deadline imageUrl status createdAt ngo';
router.get('/', async (req, res, next) => { try { const query = z.object({ category: z.enum(['food','clothing','education','medical','shelter','other']).optional(), type: z.enum(['money','goods']).optional() }).safeParse(req.query); if (!query.success) return res.status(400).json({ message: 'Invalid request filters.', details: query.error.issues }); const filter = { deletedAt: { $exists: false }, status: { $in: ['approved', 'reserved'] }, $or: [{ deadline: { $exists: false } }, { deadline: null }, { deadline: { $gt: new Date() } }] }; if (query.data.category) filter.category = query.data.category; if (query.data.type) filter.donationType = { $in: [query.data.type, 'both'] }; const requests = await DonationRequest.find(filter).select(publicRequestFields).populate({ path: 'ngo', select: 'legalName causeAreas verificationStatus', match: { verificationStatus: 'approved' } }).sort({ createdAt: -1 }).limit(100); res.json({ requests: requests.filter(r => r.ngo) }); } catch(e) { next(e); } });
router.post('/', authenticate, allowRoles('ngo'), async (req, res, next) => { try { const data = requestSchema.parse(req.body); const ngo = await NGO.findOne({ user: req.user._id, verificationStatus: 'approved' }); if (!ngo) return res.status(403).json({ message: 'Only approved NGOs can publish donation requests.' }); if (data.donationType !== 'goods' && (data.targetAmount || 0) < 1) return res.status(400).json({ message: 'Money or mixed requests require a target amount greater than zero.' }); if (['goods','both'].includes(data.donationType) && !data.goodsNeeded?.length) return res.status(400).json({ message: 'Goods requests need at least one item and quantity.' }); const request = await DonationRequest.create({ ...data, deadline: data.deadline ? new Date(data.deadline) : undefined, ngo: ngo._id }); requestEmailReview('request', request._id, request.title, `Submitted by ${ngo.legalName}; category ${request.category}; donation type ${request.donationType}.`, request.createdAt.getTime()).catch(e => console.error('Donation request review email failed:', e.message)); res.status(201).json({ request }); } catch(e) { if (e instanceof z.ZodError) return res.status(400).json({ message: 'Invalid request.', details: e.issues }); next(e); } });
router.get('/mine', authenticate, allowRoles('ngo'), async (req, res, next) => { try { const ngo = await NGO.findOne({ user: req.user._id }); res.json({ requests: ngo ? await DonationRequest.find({ ngo: ngo._id, deletedAt: { $exists: false } }).sort({ createdAt: -1 }) : [] }); } catch(e) { next(e); } });
router.get('/admin/review', authenticate, allowRoles('admin'), async (req, res, next) => { try { res.json({ requests: await DonationRequest.find({ status: 'pending', deletedAt: { $exists: false } }).populate('ngo','legalName registrationNumber verificationStatus').sort({ createdAt: 1 }) }); } catch(e) { next(e); } });
router.delete('/:id', authenticate, allowRoles('ngo', 'admin'), async (req, res, next) => {
  try {
    const request = await DonationRequest.findById(req.params.id);
    if (!request || request.deletedAt) return res.status(404).json({ message: 'Request not found.' });

    if (req.user.role === 'ngo') {
      const ngo = await NGO.findOne({ user: req.user._id });
      if (!ngo || request.ngo.toString() !== ngo._id.toString()) {
        return res.status(403).json({ message: 'You can only delete requests created by your organization.' });
      }
    }

    if (request.status === 'approved') {
      const closedRequest = await DonationRequest.findOneAndUpdate(
        { _id: request._id, status: 'approved' },
        { $set: { status: 'closed' } },
        { new: true }
      );
      if (!closedRequest) {
        return res.status(409).json({ message: 'Request changed while being deleted. Refresh and try again.' });
      }
      request.status = closedRequest.status;
    }

    if (request.status === 'approved') {
      const closedRequest = await DonationRequest.findOneAndUpdate(
        { _id: request._id, status: 'approved', deletedAt: { $exists: false } },
        { $set: { status: 'closed' } },
        { new: true }
      );
      if (!closedRequest) {
        return res.status(409).json({ message: 'Request changed while being deleted. Refresh and try again.' });
      }
      request.status = closedRequest.status;
    }

    const deletedRequest = await DonationRequest.findOneAndUpdate({
      _id: request._id,
      status: request.status,
      deletedAt: { $exists: false }
    }, {
      $set: { deletedAt: new Date(), deletedBy: req.user._id }
    }, { new: true });
    if (!deletedRequest) {
      return res.status(409).json({ message: 'Request changed while being deleted. Refresh and try again.' });
    }

    res.json({ message: 'Request removed from listings. Donation history has been retained.' });
  } catch (error) {
    next(error);
  }
});
router.get('/:id', async (req, res, next) => { try { const request = await DonationRequest.findOne({ _id: req.params.id, deletedAt: { $exists: false }, status: { $in: ['approved', 'reserved'] } }).select(publicRequestFields).populate({ path: 'ngo', select: 'legalName causeAreas verificationStatus', match: { verificationStatus: 'approved' } }); if (!request || !request.ngo) return res.status(404).json({ message: 'Approved donation request not found.' }); res.json({ request }); } catch(e) { next(e); } });
router.patch('/admin/:id/decision', authenticate, allowRoles('admin'), async (req, res, next) => {
  try {
    const parsed = z.object({ decision: z.enum(['approved', 'rejected', 'closed']), notes: z.string().trim().max(2000).optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid request decision.', details: parsed.error.issues });
    const { decision, notes = '' } = parsed.data;
    const request = await DonationRequest.findById(req.params.id);
    if (!request || request.deletedAt) return res.status(404).json({ message: 'Request not found.' });
    if (!canAdminReviewRequest(request.status, decision)) {
      return res.status(409).json({ message: `Cannot change a ${request.status} request to ${decision}.` });
    }
    if (decision === 'approved' && !(await NGO.exists({ _id: request.ngo, verificationStatus: 'approved' }))) {
      return res.status(409).json({ message: 'Requests can only be published while their NGO remains approved.' });
    }
    const updated = await DonationRequest.findOneAndUpdate(
      { _id: request._id, status: request.status, deletedAt: { $exists: false } },
      {
        $set: {
          status: decision,
          adminNotes: String(notes).slice(0, 2000),
          reviewedBy: req.user._id,
          reviewedAt: new Date()
        }
      },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(409).json({ message: 'Request status changed while processing this review.' });
    res.json({ request: updated });
  } catch(e) { next(e); }
});
export default router;
