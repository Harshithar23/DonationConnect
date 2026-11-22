const API_URL = import.meta.env.VITE_API_URL || '/api';
export function getToken() { return localStorage.getItem('dc_token'); }
export function setSession(token, user) { localStorage.setItem('dc_token', token); localStorage.setItem('dc_user', JSON.stringify(user)); }
export function clearSession() { localStorage.removeItem('dc_token'); localStorage.removeItem('dc_user'); }
export function getUser() { try { return JSON.parse(localStorage.getItem('dc_user') || 'null'); } catch { return null; } }
export async function api(path, options = {}) {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token) {
      clearSession();
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('dc:unauthorized'));
    }
    const details = Array.isArray(data.details) ? data.details.map(item => item.message).filter(Boolean).join(' ') : '';
    throw new Error([data.message || `Request failed (${response.status})`, details].filter(Boolean).join(' '));
  }
  return data;
}
