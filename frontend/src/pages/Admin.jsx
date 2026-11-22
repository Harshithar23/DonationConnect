import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, RefreshCw, ShieldAlert, Trash2, XCircle } from 'lucide-react';
import { api } from '../lib/api.js';

export default function Admin() {
  const [ngos, setNgos] = useState([]);
  const [requests, setRequests] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  async function load() {
    setError('');
    setLoading(true);
    try {
      const [ngoResult, requestResult, overview] = await Promise.all([
        api('/ngos/admin/review'),
        api('/requests/admin/review'),
        api('/admin/overview')
      ]);
      setNgos(ngoResult.ngos || []);
      setRequests(requestResult.requests || []);
      setMetrics(overview.metrics);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function decideNgo(id, decision) {
    setBusy(`ngo:${id}`);
    setError('');
    setNotice('');
    try {
      await api(`/ngos/admin/${id}/decision`, {
        method: 'PATCH',
        body: JSON.stringify({ decision, notes: decision === 'rejected' ? 'Please provide valid registration evidence and resubmit.' : '' })
      });
      setNotice(`NGO marked ${decision}.`);
      await load();
    } catch (decisionError) {
      setError(decisionError.message);
    } finally {
      setBusy('');
    }
  }

  async function decideRequest(id, decision) {
    setBusy(`request:${id}`);
    setError('');
    setNotice('');
    try {
      await api(`/requests/admin/${id}/decision`, { method: 'PATCH', body: JSON.stringify({ decision }) });
      setNotice(`Request marked ${decision}.`);
      await load();
    } catch (decisionError) {
      setError(decisionError.message);
    } finally {
      setBusy('');
    }
  }

  async function deleteRequest(request) {
    if (!window.confirm(`Remove "${request.title}" from listings? Donation history will be retained.`)) return;
    setBusy(`request:${request._id}`);
    setError('');
    setNotice('');
    try {
      await api(`/requests/${request._id}`, { method: 'DELETE' });
      setNotice('Request removed from listings. Donation history has been retained.');
      await load();
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <main className="form-page">
      <div className="container admin-container">
        <div className="dashboard-top">
          <div><div className="eyebrow eyebrow-green">PLATFORM GOVERNANCE</div><h1>Admin <em>review desk.</em></h1><p>Human review remains the final decision for verification and publication.</p></div>
          <button className="btn btn-outline" onClick={load} disabled={loading}><RefreshCw size={16}/> Refresh queue</button>
        </div>
        {error && <div className="form-alert" role="alert">{error}</div>}
        {notice && <div className="form-success" role="status">{notice}</div>}
        {metrics && (
          <>
            <div className="metric-grid">
              <div className="metric-card"><span>Total users</span><strong>{metrics.users}</strong></div>
              <div className="metric-card"><span>NGOs pending review</span><strong>{metrics.ngosPending}</strong></div>
              <div className="metric-card"><span>Approved NGOs</span><strong>{metrics.ngosApproved}</strong></div>
              <div className="metric-card"><span>Requests pending review</span><strong>{metrics.requestsPending}</strong></div>
              <div className="metric-card"><span>Money pledges (INR)</span><strong>₹{Number(metrics.moneyPledges?.amountINR || 0).toLocaleString('en-IN')}</strong><small>{metrics.moneyPledges?.count || 0} pledge records · no payments processed</small></div>
              <div className="metric-card"><span>Goods pledges</span><strong>{metrics.goodsPledges || 0}</strong></div>
            </div>
            <div className="admin-role-counts" aria-label="User counts by account role">
              {Object.entries(metrics.usersByRole || {}).map(([role, count]) => <span key={role}>{role}: <strong>{count}</strong></span>)}
            </div>
          </>
        )}
        {loading && !metrics && <p className="muted">Loading dashboard metrics…</p>}
        <section className="dashboard-card admin-queue">
          <div className="card-heading"><div><span className="eyebrow eyebrow-green">ORGANIZATION CHECKS</span><h2>NGO registrations</h2></div><span className="pill">{ngos.length} pending</span></div>
          {loading && ngos.length === 0 ? <p className="muted">Loading NGO reviews…</p> : ngos.length === 0 ? <p className="muted">No NGO registrations awaiting review.</p> : ngos.map(ngo => (
            <article className="admin-item" key={ngo._id}>
              <div className="admin-item-head"><div className="admin-item-icon"><ShieldAlert/></div><div><strong>{ngo.legalName}</strong><small>{ngo.user?.name} · {ngo.user?.email}</small></div><span className={`risk-pill ${ngo.riskScore >= 40 ? 'risk-high' : 'risk-review'}`}>Risk score {ngo.riskScore}/100</span></div>
              <div className="admin-item-details"><span>Type: {ngo.registrationType}</span><span>Registration: {ngo.registrationNumber}</span><span>Address: {ngo.registeredAddress}</span></div>
              {ngo.documents?.length > 0 && <div className="admin-doc-links">{ngo.documents.map((document, index) => <a href={document.fileUrl} target="_blank" rel="noreferrer" key={`${document.kind}-${index}`}>Review {document.kind.replaceAll('_', ' ')} ↗</a>)}</div>}
              {ngo.riskFlags?.length > 0 && <div className="risk-flags">Profile check flags: {ngo.riskFlags.join(' · ')}</div>}
              <div className="admin-actions">
                <button className="btn btn-primary btn-small" onClick={() => decideNgo(ngo._id, 'approved')} disabled={busy === `ngo:${ngo._id}`}><CheckCircle2 size={15}/> Approve</button>
                <button className="btn btn-outline btn-small" onClick={() => decideNgo(ngo._id, 'under_review')} disabled={busy === `ngo:${ngo._id}`}><Clock3 size={15}/> More review</button>
                <button className="btn btn-danger btn-small" onClick={() => decideNgo(ngo._id, 'rejected')} disabled={busy === `ngo:${ngo._id}`}><XCircle size={15}/> Reject</button>
              </div>
            </article>
          ))}
        </section>
        <section className="dashboard-card admin-queue">
          <div className="card-heading"><div><span className="eyebrow eyebrow-green">REQUEST MODERATION</span><h2>Donation requests</h2></div><span className="pill">{requests.length} pending</span></div>
          {loading && requests.length === 0 ? <p className="muted">Loading request reviews…</p> : requests.length === 0 ? <p className="muted">No donation requests awaiting review.</p> : requests.map(request => (
            <article className="admin-item" key={request._id}>
              <div className="admin-item-head"><div className="admin-item-icon"><Clock3/></div><div><strong>{request.title}</strong><small>{request.ngo?.legalName} · {request.category}</small><small>Donation type: {request.donationType === 'both' ? 'Money and goods' : request.donationType}</small></div></div>
              <p className="admin-description">{request.description}</p>
              <div className="admin-actions">
                <button className="btn btn-primary btn-small" onClick={() => decideRequest(request._id, 'approved')} disabled={busy === `request:${request._id}`}><CheckCircle2 size={15}/> Publish request</button>
                <button className="btn btn-danger btn-small" onClick={() => decideRequest(request._id, 'rejected')} disabled={busy === `request:${request._id}`}><XCircle size={15}/> Reject</button>
                <button className="btn btn-danger btn-small" onClick={() => deleteRequest(request)} disabled={busy === `request:${request._id}`}><Trash2 size={15}/> Delete request</button>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
