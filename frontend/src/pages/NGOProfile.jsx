import { useEffect, useState } from 'react';
import { FileCheck2, Save, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api.js';

const initialForm = {
  legalName: '',
  registrationType: 'trust',
  registrationNumber: '',
  registrationAuthority: '',
  registeredAddress: '',
  website: '',
  causeAreas: '',
  registrationCertificateUrl: '',
  panDocumentUrl: '',
  addressProofUrl: ''
};

export default function NGOProfile() {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState('pending');
  const [risk, setRisk] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/ngos/me')
      .then(result => {
        const ngo = result.ngo;
        if (!ngo) return;
        setForm({
          legalName: ngo.legalName || '',
          registrationType: ngo.registrationType || 'trust',
          registrationNumber: ngo.registrationNumber || '',
          registrationAuthority: ngo.registrationAuthority || '',
          registeredAddress: ngo.registeredAddress || '',
          website: ngo.website || '',
          causeAreas: (ngo.causeAreas || []).join(', '),
          registrationCertificateUrl: ngo.documents?.find(document => document.kind === 'registration_certificate')?.fileUrl || '',
          panDocumentUrl: ngo.documents?.find(document => document.kind === 'pan')?.fileUrl || '',
          addressProofUrl: ngo.documents?.find(document => document.kind === 'address_proof')?.fileUrl || ''
        });
        setStatus(ngo.verificationStatus || 'pending');
      })
      .catch(loadError => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const documents = [
        ['registration_certificate', form.registrationCertificateUrl],
        ['pan', form.panDocumentUrl],
        ['address_proof', form.addressProofUrl]
      ].filter(([, url]) => url.trim()).map(([kind, fileUrl]) => ({ kind, fileUrl }));
      const result = await api('/ngos/me', {
        method: 'PATCH',
        body: JSON.stringify({
          legalName: form.legalName,
          registrationType: form.registrationType,
          registrationNumber: form.registrationNumber,
          registrationAuthority: form.registrationAuthority,
          registeredAddress: form.registeredAddress,
          website: form.website,
          causeAreas: form.causeAreas.split(',').map(value => value.trim()).filter(Boolean),
          documents
        })
      });
      setStatus(result.ngo.verificationStatus);
      setRisk(result.riskScreening);
      setMessage('Organization profile submitted for human review.');
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  function update(key, value) {
    setForm(current => ({ ...current, [key]: value }));
  }

  return (
    <main className="form-page">
      <div className="container narrow">
        <div className="eyebrow eyebrow-green">ORGANIZATION VERIFICATION</div>
        <h1>Build a <em>trusted profile.</em></h1>
        <p className="muted">Submit accurate registration details and supporting document references. Approval requires an administrator to check authoritative records.</p>
        <div className="ngo-status-banner"><ShieldCheck/><div><strong>Current status: {status.replaceAll('_', ' ')}</strong><small>Risk screening assists review and does not establish legal authenticity.</small></div></div>
        {loading ? <p className="muted">Loading organization profile…</p> : (
          <form className="surface-form" onSubmit={submit}>
            <label>Legal organization name <span className="required-mark" aria-hidden="true">*</span><input required minLength="2" maxLength="200" value={form.legalName} onChange={event => update('legalName', event.target.value)}/></label>
            <div className="form-row">
              <label>Registration type <span className="required-mark" aria-hidden="true">*</span><select required value={form.registrationType} onChange={event => update('registrationType', event.target.value)}><option value="trust">Trust</option><option value="society">Society</option><option value="section8">Section 8 company</option><option value="other">Other</option></select></label>
              <label>Registration number <span className="required-mark" aria-hidden="true">*</span><input required minLength="1" maxLength="120" value={form.registrationNumber} onChange={event => update('registrationNumber', event.target.value)}/></label>
            </div>
            <label>Registration authority<input maxLength="200" value={form.registrationAuthority} onChange={event => update('registrationAuthority', event.target.value)}/></label>
            <label>Registered address <span className="required-mark" aria-hidden="true">*</span><textarea required minLength="5" maxLength="500" rows="3" value={form.registeredAddress} onChange={event => update('registeredAddress', event.target.value)}/></label>
            <label>Website<input type="url" placeholder="https://" value={form.website} onChange={event => update('website', event.target.value)}/></label>
            <label>Cause areas <span className="optional">(comma separated)</span><input maxLength="1600" value={form.causeAreas} onChange={event => update('causeAreas', event.target.value)} placeholder="Education, food, health"/></label>
            <div className="doc-note"><FileCheck2/><span><strong>Supporting documents</strong><small>Provide HTTPS references from secure storage. Do not use public links for sensitive documents. Production requires private object storage, access controls and malware scanning.</small></span></div>
            <label>Registration certificate URL<input type="url" placeholder="https://secure-storage.example/registration-certificate" value={form.registrationCertificateUrl} onChange={event => update('registrationCertificateUrl', event.target.value)}/></label>
            <label>PAN document URL <span className="optional">(optional)</span><input type="url" placeholder="https://secure-storage.example/pan" value={form.panDocumentUrl} onChange={event => update('panDocumentUrl', event.target.value)}/></label>
            <label>Registered address proof URL <span className="optional">(optional)</span><input type="url" placeholder="https://secure-storage.example/address-proof" value={form.addressProofUrl} onChange={event => update('addressProofUrl', event.target.value)}/></label>
            {error && <div className="form-alert" role="alert">{error}</div>}
            {message && <div className="form-success" role="status">{message}</div>}
            {risk && <div className="risk-flags">Risk score: {risk.score}/100 · {risk.flags.join(' · ') || 'No baseline flags'}<br/>{risk.explanation}</div>}
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Submitting…' : 'Save and submit for review'} <Save size={16}/></button>
          </form>
        )}
      </div>
    </main>
  );
}
