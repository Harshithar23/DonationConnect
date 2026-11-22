import { useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck, UserRound, UserRoundX } from 'lucide-react';
import { api, getUser } from '../lib/api.js';

export default function AdminUsers() {
  const currentUser = getUser();
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const result = await api('/admin/users');
      setUsers(result.users || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function changeStatus(user) {
    const status = user.status === 'active' ? 'suspended' : 'active';
    setUpdating(user._id);
    setError('');
    setNotice('');
    try {
      const result = await api(`/admin/users/${user._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      setUsers(current => current.map(item => item._id === user._id ? result.user : item));
      setNotice(`${user.name} is now ${status}.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setUpdating('');
    }
  }

  const filteredUsers = users.filter(user =>
    `${user.name} ${user.email} ${user.role} ${user.status}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <main className="form-page">
      <div className="container admin-container">
        <div className="dashboard-top">
          <div>
            <div className="eyebrow eyebrow-green">PLATFORM GOVERNANCE</div>
            <h1>Account <em>management.</em></h1>
            <p>Review account status and suspend or restore access when needed.</p>
          </div>
          <button className="btn btn-outline" onClick={load} disabled={loading}>
            <RefreshCw size={16}/> Refresh users
          </button>
        </div>
        <label className="admin-user-search">
          Search accounts
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, email, role or status"/>
        </label>
        {error && <div className="form-alert" role="alert">{error}</div>}
        {notice && <div className="form-success" role="status">{notice}</div>}
        <section className="dashboard-card admin-queue">
          <div className="card-heading">
            <div>
              <span className="eyebrow eyebrow-green">REGISTERED ACCOUNTS</span>
              <h2>Users</h2>
            </div>
            <span className="pill">{filteredUsers.length} accounts</span>
          </div>
          {loading ? <p className="muted">Loading accounts…</p> : filteredUsers.length === 0 ?
            <p className="muted">No matching accounts.</p> :
            filteredUsers.map(user => {
              const isSelf = user._id === currentUser?._id;
              return (
                <article className="admin-item" key={user._id}>
                  <div className="admin-item-head">
                    <div className="admin-item-icon">
                      {user.status === 'active' ? <UserRound/> : <UserRoundX/>}
                    </div>
                    <div>
                      <strong>{user.name}</strong>
                      <small>{user.email} · {user.role} · Joined {new Date(user.createdAt).toLocaleDateString()}</small>
                    </div>
                    <span className={`status-pill status-${user.status}`}>{user.status}</span>
                  </div>
                  <div className="admin-actions">
                    <button
                      className={user.status === 'active' ? 'btn btn-danger btn-small' : 'btn btn-primary btn-small'}
                      onClick={() => changeStatus(user)}
                      disabled={isSelf || updating === user._id}
                      title={isSelf ? 'You cannot change your own account status.' : undefined}
                    >
                      <ShieldCheck size={15}/>
                      {updating === user._id ? 'Updating…' : user.status === 'active' ? 'Suspend account' : 'Restore account'}
                    </button>
                    {isSelf && <span className="field-help">Your own admin account cannot be suspended here.</span>}
                  </div>
                </article>
              );
            })}
        </section>
      </div>
    </main>
  );
}
