import { Router } from 'express';
import { z } from 'zod';
import NGO from '../models/NGO.js';
import { authenticate, allowRoles } from '../middleware/auth.js';
import { screenNGO } from '../services/ngoScreening.js';
import { requestEmailReview } from '../services/requestReview.js';
import { notifyNgoDecision } from '../services/emailService.js';
const router = Router();
const secureDocumentUrl = z.string().url().refine(url => url.toLowerCase().startsWith('https://'), 'Document URLs must use HTTPS.');
router.get('/public', async (req, res, next) => { try { const ngos = await NGO.find({ verificationStatus: 'approved' }).select('legalName registrationType causeAreas website').limit(100).lean(); res.json({ ngos }); } catch(e) { next(e); } });
router.get('/me', authenticate, allowRoles('ngo'), async (req, res, next) => { try { res.json({ ngo: await NGO.findOne({ user: req.user._id }) }); } catch(e) { next(e); } });
router.patch('/me', authenticate, allowRoles('ngo'), async (req, res, next) => {
  try {
    const schema = z.object({ legalName: z.string().trim().min(2).max(200).optional(), registrationType: z.enum(['trust','society','section8','other']).optional(), registrationNumber: z.string().trim().min(1).max(120).optional(), registrationAuthority: z.string().trim().max(200).optional(), registeredAddress: z.string().trim().min(5).max(500).optional(), website: z.string().url().optional().or(z.literal('')), causeAreas: z.array(z.string().trim().min(1).max(80)).max(20).optional(), documents: z.array(z.object({ kind: z.enum(['registration_certificate','pan','tax_exemption','address_proof','other']), fileUrl: secureDocumentUrl })).max(20).optional() });
    const data = schema.parse(req.body); const ngo = await NGO.findOne({ user: req.user._id }); if (!ngo) return res.status(404).json({ message: 'NGO profile not found.' });
    Object.assign(ngo, data); if (ngo.verificationStatus === 'rejected') ngo.verificationStatus = 'pending';
    const existing = await NGO.find({ _id: { $ne: ngo._id } }).select('legalName registrationNumber').lean(); const risk = screenNGO(ngo.toObject(), existing); ngo.riskScore = risk.score; ngo.riskFlags = risk.flags; ngo.verificationStatus = 'pending'; await ngo.save();
    requestEmailReview('ngo', ngo._id, ngo.legalName, `NGO profile resubmitted for review. Risk score: ${risk.score}/100.`, ngo.updatedAt.getTime()).catch(e => console.error('NGO review email failed:', e.message));
    res.json({ ngo, riskScreening: risk });
  } catch(e) { if (e instanceof z.ZodError) return res.status(400).json({ message: 'Invalid NGO profile.', details: e.issues }); next(e); }
});
router.get('/admin/review', authenticate, allowRoles('admin'), async (req, res, next) => { try { const ngos = await NGO.find({ verificationStatus: { $in: ['pending','under_review'] } }).populate('user','name email createdAt').sort({ createdAt: 1 }); res.json({ ngos }); } catch(e) { next(e); } });
router.patch('/admin/:id/decision', authenticate, allowRoles('admin'), async (req, res, next) => {
  try {
    const parsed = z.object({ decision: z.enum(['approved','rejected','under_review','suspended']), notes: z.string().trim().max(2000).optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid NGO review decision.', details: parsed.error.issues });
    const { decision, notes = '' } = parsed.data;
    const ngo = await NGO.findById(req.params.id).populate('user','email name');
    if (!ngo) return res.status(404).json({ message: 'NGO not found.' });
    const previousDecision = ngo.verificationStatus;
    ngo.verificationStatus = decision;
    ngo.verificationNotes = notes;
    ngo.reviewedBy = req.user._id;
    ngo.reviewedAt = new Date();
    await ngo.save();
    if (previousDecision !== decision) {
      notifyNgoDecision({ user: ngo.user, ngo, decision, notes: ngo.verificationNotes, eventId: ngo.reviewedAt.getTime() });
    }
    res.json({ ngo });
  } catch(e) { next(e); }
});
export default router;
