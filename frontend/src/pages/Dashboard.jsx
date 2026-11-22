import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CircleDollarSign, PackageCheck, RefreshCw, Trash2 } from 'lucide-react';
import { api, getUser } from '../lib/api.js';

function donationLabel(donation) {
  if (donation.type === 'money') return 'Pledge record only';
  return donation.tracking?.at(-1)?.status?.replaceAll('_', ' ') || donation.status;
}

export default function Dashboard() {
  const [user, setUser] = useState(getUser());
  const [donations, setDonations] = useState([]);
  const [requests, setRequests] = useState([]);
  const [ngoStatus, setNgoStatus] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const profile = await api('/auth/me');
      setUser(profile.user);
      const [donationResult, requestResult, ngoResult] = await Promise.all([
        api('/donations/mine'),
        profile.user.role === 'ngo' ? api('/requests/mine') : Promise.resolve({ requests: [] }),
        profile.user.role === 'ngo' ? api('/ngos/me') : Promise.resolve({ ngo: null })
      ]);
      setDonations(donationResult.donations || []);
      setRequests(requestResult.requests || []);
      setNgoStatus(ngoResult.ngo?.verificationStatus || '');
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function deleteRequest(request) {
    if (!window.confirm(`Remove "${request.title}" from listings? Donation history will be retained.`)) return;
    setBusy(request._id);
    setError('');
    setNotice('');
    try {
      await api(`/requests/${request._id}`, { method: 'DELETE' });
      setRequests(current => current.filter(item => item._id !== request._id));
      setNotice('Request removed from listings. Donation history has been retained.');
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setBusy('');
    }
  }

  const moneyTotal = donations
    .filter(donation => donation.type === 'money')
    .reduce((total, donation) => total + Number(donation.amount || 0), 0);
  const goodsCount = donations.filter(donation => donation.type === 'goods').length;
  const visibleDonations = donations.filter(donation => donation.status !== 'pledged');
  const role = user?.role;

  return (
    <main className="form-page">
      <div className="container admin-container">
        <div className="dashboard-top">
          <div>
            <div className="eyebrow eyebrow-green">YOUR DASHBOARD</div>
            <h1>Welcome, <em>{user?.name || 'there'}.</em></h1>
            <p>Review your pledge records and keep track of donation coordination.</p>
          </div>
          <button className="btn btn-outline" onClick={load} disabled={loading}>
            <RefreshCw size={16}/> Refresh
          </button>
        </div>

        {error && <div className="form-alert" role="alert">{error}</div>}
        {notice && <div className="form-success" role="status">{notice}</div>}
        {role === 'ngo' && ngoStatus && (
          <div className="form-alert" role="status">NGO profile status: {ngoStatus.replaceAll('_', ' ')}. Requests require admin approval before publication.</div>
        )}

        <div className="metric-grid">
          <div className="metric-card"><span>Money pledges recorded</span><strong>₹{moneyTotal.toLocaleString('en-IN')}</strong><small>Records only; no payment is processed or confirmed.</small></div>
          <div className="metric-card"><span>Goods pledges</span><strong>{goodsCount}</strong><small>Items coordinated through the app.</small></div>
          {role === 'ngo' && <div className="metric-card"><span>Your donation requests</span><strong>{requests.length}</strong><small>Includes pending and published requests.</small></div>}
        </div>

        {role === 'ngo' && (
          <section className="dashboard-card admin-queue">
            <div className="card-heading">
              <div><span className="eyebrow eyebrow-green">YOUR ORGANIZATION</span><h2>Donation requests</h2></div>
              <Link className="btn btn-outline btn-small" to="/ngo-profile">NGO profile <ArrowRight size={15}/></Link>
            </div>
            {loading ? <p className="muted">Loading your requests…</p> : requests.length === 0 ? (
              <p className="muted">No requests yet. Complete your NGO profile and submit a request for admin review.</p>
            ) : requests.map(request => (
              <article className="admin-item" key={request._id}>
                <div className="admin-item-head">
                  <div className="admin-item-icon"><PackageCheck/></div>
                  <div><strong>{request.title}</strong><small>{request.category} · {request.status?.replaceAll('_', ' ')}</small></div>
                </div>
                <p className="admin-description">{request.description}</p>
                {request.donationType !== 'goods' && <small className="muted">Money target: ₹{Number(request.targetAmount || 0).toLocaleString('en-IN')} · pledges are not confirmed payments.</small>}
                <div className="admin-actions">
                  <button
                    className="btn btn-danger btn-small"
                    type="button"
                    disabled={busy === request._id}
                    title="Remove request from listings"
                    onClick={() => deleteRequest(request)}
                  ><Trash2 size={15}/> Delete request</button>
                </div>
              </article>
            ))}
            <Link className="btn btn-primary btn-small" to="/requests/new">Create a request <ArrowRight size={15}/></Link>
          </section>
        )}

        <section className="dashboard-card admin-queue">
          <div className="card-heading">
            <div><span className="eyebrow eyebrow-green">DONATION ACTIVITY</span><h2>Your donations</h2></div>
            <Link className="btn btn-outline btn-small" to="/requests">Explore requests <ArrowRight size={15}/></Link>
          </div>
          {loading ? <p className="muted">Loading donation activity…</p> : visibleDonations.length === 0 ? (
            <p className="muted">{donations.length === 0 ? 'No donation records yet.' : 'Pledged records are hidden here; donation history is retained.'}</p>
          ) : visibleDonations.map(donation => (
            <article className="admin-item" key={donation._id}>
              <div className="admin-item-head">
                <div className="admin-item-icon">{donation.type === 'money' ? <CircleDollarSign/> : <PackageCheck/>}</div>
                <div>
                  <strong>{donation.request?.title || `${donation.type} donation`}</strong>
                  <small>{donation.ngo?.legalName || 'NGO'} · {new Date(donation.createdAt).toLocaleDateString()}</small>
                  <small>{donation.type === 'money' ? `₹${Number(donation.amount || 0).toLocaleString('en-IN')} · ${donationLabel(donation)}` : donationLabel(donation)}</small>
                </div>
                {donation.type === 'goods' && <Link className="btn btn-outline btn-small" to={`/tracking/${donation._id}`}>Track <ArrowRight size={14}/></Link>}
              </div>
            </article>
          ))}
        </section>

        {role === 'admin' && <Link className="btn btn-primary" to="/admin">Open admin review desk <ArrowRight size={16}/></Link>}
      </div>
    </main>
  );
}
