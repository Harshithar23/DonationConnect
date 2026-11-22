import { Link, NavLink, useNavigate } from 'react-router-dom';
import { HeartHandshake, Menu, X, LogOut, LayoutDashboard } from 'lucide-react';
import { useState } from 'react';
import { clearSession, getUser } from '../lib/api.js';
export default function Navbar() {
  const [open, setOpen] = useState(false); const user = getUser(); const navigate = useNavigate();
  function logout() { clearSession(); setOpen(false); navigate('/'); }
  return <header className="nav-shell"><nav className="nav container" aria-label="Main navigation"><Link to="/" className="brand" onClick={() => setOpen(false)}><span className="brand-icon"><HeartHandshake size={22}/></span><span>donation<span className="brand-accent">connect</span><small>GIVE WITH CONFIDENCE</small></span></Link><button className="menu-toggle" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X/> : <Menu/>}</button><div className={`nav-links ${open ? 'nav-open' : ''}`}><a href="/#how-it-works" onClick={() => setOpen(false)}>How it works</a><a href="/#causes" onClick={() => setOpen(false)}>Explore causes</a><a href="/#trust" onClick={() => setOpen(false)}>Trust & safety</a>{user ? <><NavLink to="/dashboard" onClick={() => setOpen(false)} className="nav-dashboard"><LayoutDashboard size={16}/> Dashboard</NavLink><button className="btn btn-outline nav-logout" onClick={logout}><LogOut size={15}/> Sign out</button></> : <><Link to="/login" className="nav-signin" onClick={() => setOpen(false)}>Sign in</Link><Link to="/register" className="btn btn-primary nav-register" onClick={() => setOpen(false)}>Create account</Link></>}</div></nav></header>;
}
