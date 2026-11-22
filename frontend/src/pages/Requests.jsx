import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Filter, Heart, MapPin, Plus, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { api, getUser } from '../lib/api.js';
import './DonationPledge.css';

const categories = ['food', 'clothing', 'education', 'medical', 'shelter', 'other'];

export function Requests() {
  const [requests, setRequests] = useState([]);
  const [ngos, setNgos] = useState([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const user = getUser();

  useEffect(() => {
    Promise.all([api('/requests'), api('/ngos/public')])
      .then(([requestResult, ngoResult]) => {
        setRequests(requestResult.requests || []);
        setNgos(ngoResult.ngos || []);
      })
      .catch(error => setError(error.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = requests.filter(request =>
    (category === 'all' || request.category === category) &&
    `${request.title} ${request.description} ${request.ngo?.legalName} ${request.location?.city}`
      .toLowerCase().includes(query.toLowerCase())
  );

  return (
    <main className="listing-page">
      <div className="listing-hero">
        <div className="container">
          <div className="eyebrow eyebrow-green">FIND YOUR CONNECTION</div>
          <h1>Every need deserves<br/><em>a chance to be met.</em></h1>
          <p>Explore active requests from approved NGOs and discover where your generosity can make a difference.</p>
          <div className="listing-search">
            <Search size={19}/>
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search causes, needs or locations" aria-label="Search donation requests"/>
            <Filter size={17}/>
          </div>
        </div>
      </div>
      <div className="container listing-content">
        <div className="filter-row">
          <span>{filtered.length} community needs</span>
          <select value={category} onChange={event => setCategory(event.target.value)} aria-label="Filter by cause">
            <option value="all">All causes</option>
            {categories.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
          </select>
        </div>
        {error && <div className="form-alert" role="alert">{error}</div>}
        {loading ? <div className="empty-state">Loading community needs…</div> : filtered.length === 0 ?
          <div className="empty-state listing-empty">
            <Heart size={28}/>
            <strong>No published requests just yet.</strong>
            <span>Approved NGO requests will appear here. Try another search or come back soon.</span>
            {user ? <Link to="/dashboard" className="text-link">Go to dashboard <ArrowRight size={16}/></Link> : <Link to="/login" className="text-link">Sign in <ArrowRight size={16}/></Link>}
          </div> :
          <div className="request-grid">
            {filtered.map(request => (
              <article className="request-card" key={request._id}>
                <div className="request-card-image">
                  {request.imageUrl ? <img src={request.imageUrl} alt=""/> : <div className="request-placeholder"><Heart size={31}/></div>}
                  <span className="cause-tag">{request.category}</span>
                </div>
                <div className="request-card-content">
                  <div className="request-card-status">
                    <div className="verified-label"><ShieldCheck size={14}/> Admin-approved NGO profile</div>
                    {request.status === 'reserved' && <span className="pledge-status">Pledge in progress</span>}
                  </div>
                  <h2>{request.title}</h2>
                  <p>{request.description}</p>
                  <div className="request-ngo">
                    <strong>{request.ngo?.legalName}</strong>
                    <span><MapPin size={13}/>{request.location?.city || 'Location not listed'}</span>
                  </div>
                  {request.donationType !== 'goods' && <div className="funding"><div><span>Target</span><strong>₹{(request.targetAmount || 0).toLocaleString('en-IN')}</strong><small>Money contributions are pledge records only; no online payment is processed.</small></div></div>}
                  {request.status === 'reserved' ?
                    <button className="btn btn-outline request-donate" type="button" disabled>Pledge already in progress</button> :
                    <Link className="btn btn-primary request-donate" to={`/donate/${request._id}`}>Support this need <ArrowRight size={16}/></Link>
                  }
                </div>
              </article>
            ))}
          </div>
        }
        <section className="ngo-discovery">
          <div>
            <div className="eyebrow eyebrow-green">MEET THE ORGANIZATIONS</div>
            <h2>Start with a <em>trusted connection.</em></h2>
            <p>Discover approved organizations working in communities across different cause areas.</p>
          </div>
          <div className="ngo-pills">
            {ngos.slice(0, 8).map(ngo => <span key={ngo._id}><ShieldCheck size={14}/>{ngo.legalName}</span>)}
            {ngos.length === 0 && <span>Approved NGO profiles will appear here.</span>}
          </div>
        </section>
      </div>
    </main>
  );
}

export function NewRequest() {
  const [form, setForm] = useState({
    title: '', description: '', category: 'food', donationType: 'money',
    targetAmount: '', goodsNeeded: [{ item: '', quantity: 1, unit: 'items' }],
    city: '', state: '', address: '', deadline: ''
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function updateItem(index, key, value) {
    setForm(current => ({
      ...current,
      goodsNeeded: current.goodsNeeded.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      )
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        category: form.category,
        donationType: form.donationType,
        targetAmount: Number(form.targetAmount || 0),
        goodsNeeded: form.goodsNeeded.filter(item => item.item.trim()).map(item => ({ ...item, quantity: Number(item.quantity) })),
        location: { city: form.city, state: form.state, address: form.address },
        ...(form.deadline ? { deadline: new Date(`${form.deadline}T23:59:59`).toISOString() } : {})
      };
      const result = await api('/requests', { method: 'POST', body: JSON.stringify(payload) });
      setMessage(`Request submitted. Current status: ${result.request.status}. An administrator must approve it before publication.`);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="form-page">
      <div className="container narrow">
        <div className="eyebrow eyebrow-green">NGO DASHBOARD</div>
        <h1>Create a <em>donation request.</em></h1>
        <p className="muted">Only approved NGOs can submit requests for admin review.</p>
        <form className="surface-form" onSubmit={submit}>
          <label>Request title <span className="required-mark" aria-hidden="true">*</span><input required minLength="5" maxLength="140" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="e.g. School kits for 50 children"/></label>
          <label>Describe the need <span className="required-mark" aria-hidden="true">*</span><textarea required minLength="20" maxLength="3000" rows="4" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Explain who this supports and what is needed…"/></label>
          <div className="form-row">
            <label>Cause category <span className="required-mark" aria-hidden="true">*</span><select required value={form.category} onChange={event => setForm({ ...form, category: event.target.value })}>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
            <label>Donation type <span className="required-mark" aria-hidden="true">*</span><select required value={form.donationType} onChange={event => setForm({ ...form, donationType: event.target.value })}><option value="money">Money</option><option value="goods">Goods</option><option value="both">Money and goods</option></select></label>
          </div>
          {form.donationType !== 'goods' && <label>Target amount (INR) <span className="required-mark" aria-hidden="true">*</span><input type="number" min="1" step="1" required value={form.targetAmount} onChange={event => setForm({ ...form, targetAmount: event.target.value })}/></label>}
          {['goods', 'both'].includes(form.donationType) && (
            <div className="goods-request-items">
              <strong>Items needed</strong>
              {form.goodsNeeded.map((item, index) => (
                <div className="form-row" key={index}>
                  <label>Item <span className="required-mark" aria-hidden="true">*</span><input required value={item.item} onChange={event => updateItem(index, 'item', event.target.value)} placeholder="e.g. notebooks"/></label>
                  <label>Quantity <span className="required-mark" aria-hidden="true">*</span><input required type="number" min="1" step="1" value={item.quantity} onChange={event => updateItem(index, 'quantity', event.target.value)}/></label>
                  <label>Unit <span className="required-mark" aria-hidden="true">*</span><input required maxLength="30" value={item.unit} onChange={event => updateItem(index, 'unit', event.target.value)} placeholder="items"/></label>
                  {form.goodsNeeded.length > 1 && <button type="button" className="btn btn-outline btn-small" aria-label={`Remove item ${index + 1}`} onClick={() => setForm(current => ({ ...current, goodsNeeded: current.goodsNeeded.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 size={15}/> Remove</button>}
                </div>
              ))}
              <button type="button" className="btn btn-outline btn-small" onClick={() => setForm(current => ({ ...current, goodsNeeded: [...current.goodsNeeded, { item: '', quantity: 1, unit: 'items' }] }))}><Plus size={15}/> Add another item</button>
            </div>
          )}
          <div className="form-row"><label>City <span className="required-mark" aria-hidden="true">*</span><input required maxLength="100" value={form.city} onChange={event => setForm({ ...form, city: event.target.value })}/></label><label>State <span className="required-mark" aria-hidden="true">*</span><input required maxLength="100" value={form.state} onChange={event => setForm({ ...form, state: event.target.value })}/></label></div>
          <label>Collection / organization address <span className="required-mark" aria-hidden="true">*</span><input required minLength="5" maxLength="500" value={form.address} onChange={event => setForm({ ...form, address: event.target.value })}/></label>
          <label>Request deadline <span className="optional">(optional)</span><input type="date" min={new Date().toISOString().slice(0, 10)} value={form.deadline} onChange={event => setForm({ ...form, deadline: event.target.value })}/></label>
          {error && <div className="form-alert" role="alert">{error}</div>}
          {message && <div className="form-success" role="status">{message}</div>}
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit for admin review'} <ArrowRight size={17}/></button>
        </form>
      </div>
    </main>
  );
}

export function Donate() {
  const { requestId } = useParams();
  const user = getUser();
  const [form, setForm] = useState({
    ngoId: '', requestId: requestId || '', type: user?.role === 'individual' ? 'money' : 'goods',
    amount: '1000', name: '', phone: '', address: '', city: '', state: '', postalCode: '',
    items: [{ name: '', quantity: 1, unit: 'items' }]
  });
  const [ngos, setNgos] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [donation, setDonation] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const jobs = [api('/ngos/public')];
    if (requestId) jobs.push(api(`/requests/${requestId}`));
    Promise.all(jobs)
      .then(([ngoResult, requestResult]) => {
        setNgos(ngoResult.ngos || []);
        if (requestResult?.request) {
          setSelectedRequest(requestResult.request);
          setForm(current => ({ ...current, ngoId: requestResult.request.ngo?._id || '', requestId, type: user?.role === 'individual' ? 'money' : 'goods' }));
        }
      })
      .catch(loadError => setError(loadError.message))
      .finally(() => setLoading(false));
  }, [requestId, user?.role]);

  const requestTypeMismatch = Boolean(selectedRequest && selectedRequest.donationType !== 'both' && selectedRequest.donationType !== form.type);
  const requestTypeError = requestTypeMismatch
    ? form.type === 'money' ? 'This request accepts goods donations. Company and organization accounts can donate goods only.' : 'This request accepts money donations. Only individual donor accounts can donate money.'
    : '';

  function updateItem(index, key, value) {
    setForm(current => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item)
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = {
        ngoId: form.ngoId,
        requestId: form.requestId || undefined,
        type: form.type,
        ...(form.type === 'money'
          ? { amount: Number(form.amount) }
          : {
              pickup: { donorName: form.name, phone: form.phone, address: form.address, city: form.city, state: form.state, postalCode: form.postalCode },
              items: form.items.filter(item => item.name.trim()).map(item => ({ ...item, quantity: Number(item.quantity) }))
            })
      };
      const result = await api('/donations', { method: 'POST', body: JSON.stringify(payload) });
      setDonation(result.donation);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  const donationAmounts = Array.from({ length: 10 }, (_, index) => (index + 1) * 1000);
  if (loading) return <main className="form-page"><div className="container narrow">Loading pledge options…</div></main>;

  return (
    <main className="form-page">
      <div className="container narrow">
        <div className="eyebrow eyebrow-green">MAKE A DIFFERENCE</div>
        <h1>Turn care into <em>action.</em></h1>
        <p className="muted">{user?.role === 'individual' ? 'Individual donor accounts can record money pledges only.' : 'Company and organization accounts can record goods pledges only.'}</p>
        {donation ? (
          <section className="pledge-panel" role="status">
            <div className="notice-icon"><Heart/></div>
            <h2>Pledge recorded</h2>
            <p>{donation.type === 'money'
              ? `Your INR ${Number(donation.amount).toLocaleString('en-IN')} pledge has been saved as a record. No payment was processed or confirmed.`
              : 'Your goods pledge has been saved. The NGO can update its pickup and receipt milestones.'}</p>
            <p><strong>Reference:</strong> {donation._id}</p>
            <Link className="btn btn-primary" to={`/tracking/${donation._id}`}>View donation tracking <ArrowRight size={17}/></Link>
          </section>
        ) : selectedRequest?.status === 'reserved' ? (
          <div className="pledge-panel">
            <div className="notice-icon"><Heart/></div>
            <h2>This need already has a donor</h2>
            <p>A donor has pledged to support this request. New pledges are not accepted while that donation is in progress.</p>
            <Link to="/requests" className="btn btn-outline">Back to Explore Needs</Link>
          </div>
        ) : (
          <form className="surface-form" onSubmit={submit}>
            {selectedRequest && <div className="selected-request"><strong>Supporting: {selectedRequest.title}</strong><span>{selectedRequest.ngo?.legalName}</span></div>}
            <label>Choose approved NGO <span className="required-mark" aria-hidden="true">*</span><select required value={form.ngoId} onChange={event => setForm({ ...form, ngoId: event.target.value })}><option value="">Select organization</option>{ngos.map(ngo => <option key={ngo._id} value={ngo._id}>{ngo.legalName}</option>)}</select></label>
            <label>Pledge type<select value={form.type} disabled><option value="money">Money pledge (individual donors only)</option><option value="goods">Goods pledge (company and organization donors)</option></select></label>
            {form.type === 'money' ? (
              <fieldset className="donation-amounts">
                <legend>Select pledge amount (INR) <span className="required-mark" aria-hidden="true">*</span></legend>
                <div className="amount-options fixed-amount-options" role="group" aria-label="Choose a fixed pledge amount">
                  {donationAmounts.map(amount => <button key={amount} type="button" className={`amount-option${form.amount === String(amount) ? ' is-selected' : ''}`} aria-pressed={form.amount === String(amount)} onClick={() => setForm({ ...form, amount: String(amount) })}>₹{amount.toLocaleString('en-IN')}</button>)}
                </div>
                <span className="field-help">Choose one fixed pledge amount. This records a pledge only; online payment is not available.</span>
              </fieldset>
            ) : (
              <>
                <label>Contact name <span className="required-mark" aria-hidden="true">*</span><input required minLength="2" maxLength="120" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })}/></label>
                <label>Contact phone <span className="required-mark" aria-hidden="true">*</span><input required minLength="5" maxLength="25" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })}/></label>
                <div className="goods-request-items">
                  <strong>Goods to pledge</strong>
                  {form.items.map((item, index) => (
                    <div className="form-row" key={index}>
                      <label>Item name <span className="required-mark" aria-hidden="true">*</span><input required maxLength="100" value={item.name} onChange={event => updateItem(index, 'name', event.target.value)} placeholder="e.g. notebooks"/></label>
                      <label>Quantity <span className="required-mark" aria-hidden="true">*</span><input required type="number" min="1" step="1" value={item.quantity} onChange={event => updateItem(index, 'quantity', event.target.value)}/></label>
                      <label>Unit <span className="required-mark" aria-hidden="true">*</span><input required maxLength="30" value={item.unit} onChange={event => updateItem(index, 'unit', event.target.value)}/></label>
                      {form.items.length > 1 && <button type="button" className="btn btn-outline btn-small" aria-label={`Remove goods item ${index + 1}`} onClick={() => setForm(current => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 size={15}/> Remove</button>}
                    </div>
                  ))}
                  <button type="button" className="btn btn-outline btn-small" onClick={() => setForm(current => ({ ...current, items: [...current.items, { name: '', quantity: 1, unit: 'items' }] }))}><Plus size={15}/> Add another item</button>
                </div>
                <label>Pickup address <span className="required-mark" aria-hidden="true">*</span><textarea required minLength="5" maxLength="500" rows="3" value={form.address} onChange={event => setForm({ ...form, address: event.target.value })}/></label>
                <div className="form-row"><label>City <span className="required-mark" aria-hidden="true">*</span><input required maxLength="100" value={form.city} onChange={event => setForm({ ...form, city: event.target.value })}/></label><label>State <span className="required-mark" aria-hidden="true">*</span><input required maxLength="100" value={form.state} onChange={event => setForm({ ...form, state: event.target.value })}/></label></div>
                <label>Postal code <span className="required-mark" aria-hidden="true">*</span><input required minLength="3" maxLength="15" value={form.postalCode} onChange={event => setForm({ ...form, postalCode: event.target.value })}/></label>
              </>
            )}
            {(error || requestTypeError) && <div className="form-alert" role="alert">{error || requestTypeError}</div>}
            <button className="btn btn-primary" disabled={busy || !ngos.length || requestTypeMismatch}>{busy ? 'Saving pledge…' : 'Record pledge'} <ArrowRight size={17}/></button>
          </form>
        )}
      </div>
    </main>
  );
}
