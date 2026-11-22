import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock3, PackageCheck, RefreshCw, ShieldCheck } from 'lucide-react';
import { api, getUser } from '../lib/api.js';

const labels = {
  pledged: 'Pledge recorded',
  awaiting_payment_verification: 'Legacy payment status',
  confirmed: 'Legacy status (not verified by this version)',
  pickup_scheduled: 'Pickup scheduled',
  collected: 'Collected from donor',
  received: 'Received by NGO',
  completed: 'Completed',
  disputed: 'Disputed',
  cancelled: 'Cancelled'
};

const goodsTransitions = {
  pledged: ['pickup_scheduled', 'disputed', 'cancelled'],
  pickup_scheduled: ['collected', 'disputed', 'cancelled'],
  collected: ['received', 'disputed'],
  received: ['completed', 'disputed']
};

function statusLabel(donation, status) {
  if (donation.type === 'money' && ['awaiting_payment_verification', 'confirmed'].includes(status)) {
    return 'Legacy status (not payment confirmation)';
  }
  return labels[status] || status?.replaceAll('_', ' ');
}

function statusNote(donation, entry) {
  if (donation.type === 'money' && ['awaiting_payment_verification', 'confirmed'].includes(entry.status)) {
    return 'Historical status retained with the donation record; this app does not process or confirm payments.';
  }
  return entry.note || 'Status updated.';
}

export default function Tracking() {
  const { id } = useParams();
  const user = getUser();
  const [donation, setDonation] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [nextStatus, setNextStatus] = useState('');
  const [note, setNote] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const result = await api(`/donations/${id}`);
      setDonation(result.donation);
      setReceiptUrl(result.donation.receiptUrl || '');
      setNextStatus(goodsTransitions[result.donation.status]?.[0] || '');
    } catch (loadError) {
      setError(loadError.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateTracking(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api(`/donations/${id}/tracking`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus, note, receiptUrl: receiptUrl || undefined })
      });
      setDonation(result.donation);
      setNote('');
      setNextStatus(goodsTransitions[result.donation.status]?.[0] || '');
      setNotice('Donation timeline updated.');
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !donation) {
    return <main className="form-page"><div className="container narrow"><div className="form-alert" role="alert">{error}</div><Link to="/dashboard" className="text-link">Back to dashboard</Link></div></main>;
  }
  if (!donation) return <main className="form-page"><div className="container narrow">Loading donation timeline…</div></main>;

  const statuses = donation.type === 'goods' ? goodsTransitions[donation.status] || [] : [];
  const canUpdateTimeline = user?.role === 'ngo' && donation.type === 'goods' && statuses.length > 0;

  return (
    <main className="form-page">
      <div className="container tracking-container">
        <Link to="/dashboard" className="back-home"><ArrowLeft size={16}/> Back to dashboard</Link>
        <div className="tracking-heading">
          <div>
            <div className="eyebrow eyebrow-green">DONATION JOURNEY</div>
            <h1>Every step, <em>connected.</em></h1>
            <p>Reference: {donation._id}</p>
          </div>
          <div className="tracking-heading-actions">
            <button className="btn btn-outline" onClick={load} disabled={busy}><RefreshCw size={16}/> Refresh</button>
            <span className={`status-pill status-${donation.type === 'money' ? 'pledged' : donation.status}`}>
              {donation.type === 'money' && !['cancelled', 'disputed'].includes(donation.status) ? 'Pledge record only' : statusLabel(donation, donation.status)}
            </span>
          </div>
        </div>
        {error && <div className="form-alert" role="alert">{error}</div>}
        {notice && <div className="form-success" role="status">{notice}</div>}
        <div className="tracking-grid">
          <section className="tracking-card">
            <div className="tracking-card-head">
              <div className="tracking-icon"><PackageCheck/></div>
              <div>
                <h2>{donation.ngo?.legalName || 'Donation'}</h2>
                <p>{donation.type === 'money' ? `₹${Number(donation.amount).toLocaleString('en-IN')} money pledge` : `${donation.items?.length || 0} goods item types`}</p>
              </div>
            </div>
            {donation.type === 'money' && <div className="form-alert">This is a pledge record only. DonationConnect has not processed or confirmed a payment.</div>}
            <div className="timeline">
              {(donation.tracking || []).map((item, index) => (
                <div className="timeline-item" key={`${item.status}-${index}`}>
                  <span className="timeline-dot"><CheckCircle2 size={17}/></span>
                  <div>
                    <strong>{statusLabel(donation, item.status)}</strong>
                    <p>{statusNote(donation, item)}</p>
                    <small>{new Date(item.timestamp).toLocaleString()}</small>
                  </div>
                </div>
              ))}
              {!['completed', 'cancelled', 'disputed'].includes(donation.status) && donation.type === 'goods' && (
                <div className="timeline-item timeline-next">
                  <span className="timeline-dot"><Clock3 size={17}/></span>
                  <div><strong>Next update</strong><p>New milestones appear when the responsible NGO updates this donation.</p></div>
                </div>
              )}
            </div>
          </section>
          <aside className="tracking-side">
            <div className="notice-card">
              <div className="notice-icon"><ShieldCheck/></div>
              <strong>Transparent by design</strong>
              <p>{donation.type === 'money'
                ? 'Money pledges are recorded here; no online payment is processed.'
                : 'This timeline records updates submitted by the owning NGO and is not independent proof of delivery.'}</p>
            </div>
            {donation.type === 'goods' && donation.pickup && (
              <div className="tracking-info">
                <span>Pickup address</span>
                <strong>{donation.pickup.address}</strong>
                <small>{donation.pickup.city}, {donation.pickup.state} {donation.pickup.postalCode}</small>
                {donation.pickup.preferredDate && <small>Preferred: {new Date(donation.pickup.preferredDate).toLocaleDateString()}</small>}
              </div>
            )}
            {donation.type === 'goods' && donation.receiptUrl && <a className="text-link" href={donation.receiptUrl} target="_blank" rel="noreferrer">View receipt reference ↗</a>}
            {canUpdateTimeline && (
              <form className="surface-form tracking-update-form" onSubmit={updateTracking}>
                <h2>Update donation timeline</h2>
                <label>Next status <span className="required-mark" aria-hidden="true">*</span>
                  <select required value={nextStatus} onChange={event => setNextStatus(event.target.value)}>
                    {statuses.map(status => <option key={status} value={status}>{labels[status]}</option>)}
                  </select>
                </label>
                <label>Update note <span className="required-mark" aria-hidden="true">*</span>
                  <textarea required minLength="3" maxLength="1000" rows="3" value={note} onChange={event => setNote(event.target.value)} placeholder="Explain this milestone for the donor"/>
                </label>
                <label>Receipt reference {nextStatus === 'completed' ? <span className="required-mark" aria-hidden="true">*</span> : <span className="optional">(optional)</span>}
                  <input type="url" required={nextStatus === 'completed'} value={receiptUrl} onChange={event => setReceiptUrl(event.target.value)} placeholder="https://…"/>
                </label>
                <span className="field-help">Use an HTTPS reference. Keep sensitive documents in access-controlled storage.</span>
                <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save timeline update'}</button>
              </form>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
