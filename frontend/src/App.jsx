import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import Auth from './pages/Auth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import { Donate, NewRequest, Requests } from './pages/Requests.jsx';
import Tracking from './pages/Tracking.jsx';
import Profile from './pages/Profile.jsx';
import NGOProfile from './pages/NGOProfile.jsx';
import EmailReview from './pages/EmailReview.jsx';
import Admin from './pages/Admin.jsx';
import AdminUsers from './pages/AdminUsers.jsx';
import { getUser } from './lib/api.js';

function Shell({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthPage = ['/login', '/register', '/forgot-password', '/reset-password'].includes(location.pathname);

  useEffect(() => {
    function handleUnauthorized() {
      if (isAuthPage) return;
      const next = `${location.pathname}${location.search}`;
      navigate(`/login?next=${encodeURIComponent(next)}`, { replace: true });
    }

    window.addEventListener('dc:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('dc:unauthorized', handleUnauthorized);
  }, [isAuthPage, location.pathname, location.search, navigate]);

  return isAuthPage ? children : <><Navbar/>{children}<Footer/></>;
}

function Guard({ children, roles }) {
  const user = getUser();
  const location = useLocation();
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace/>;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace/>;
  return children;
}

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Home/>}/>
        <Route path="/login" element={<Auth mode="login"/>}/>
        <Route path="/register" element={<Auth mode="register"/>}/>
        <Route path="/forgot-password" element={<Auth mode="forgot"/>}/>
        <Route path="/reset-password" element={<Auth mode="reset"/>}/>
        <Route path="/email-review" element={<EmailReview/>}/>
        <Route path="/dashboard" element={<Guard><Dashboard/></Guard>}/>
        <Route path="/requests" element={<Requests/>}/>
        <Route path="/requests/new" element={<Guard roles={['ngo']}><NewRequest/></Guard>}/>
        <Route path="/ngo-profile" element={<Guard roles={['ngo']}><NGOProfile/></Guard>}/>
        <Route path="/donate/:requestId" element={<Guard roles={['individual','company','organization']}><Donate/></Guard>}/>
        <Route path="/tracking/:id" element={<Guard><Tracking/></Guard>}/>
        <Route path="/profile" element={<Guard><Profile/></Guard>}/>
        <Route path="/admin" element={<Guard roles={['admin']}><Admin/></Guard>}/>
        <Route path="/admin/users" element={<Guard roles={['admin']}><AdminUsers/></Guard>}/>
        <Route path="*" element={<main className="form-page"><div className="container narrow"><h1>Page not found</h1><a href="/">Return home</a></div></main>}/>
      </Routes>
    </Shell>
  );
}
