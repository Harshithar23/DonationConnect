import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CheckCircle2, HandHeart, HeartHandshake, MapPin, PackageCheck, ShieldCheck, UsersRound } from 'lucide-react';

const causes = [
  {
    title: 'Education for every child',
    category: 'Education',
    description: 'Help community organizations provide learning supplies and support.',
    image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=900&q=85'
  },
  {
    title: 'Food for local families',
    category: 'Food',
    description: 'Support local food drives with money or useful goods.',
    image: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=900&q=85'
  },
  {
    title: 'Care when it matters',
    category: 'Community care',
    description: 'Find community requests for shelter, health and essential supplies.',
    image: 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=900&q=85'
  }
];

export default function Home() {
  return <main>
    <section className="hero" id="top">
      <div className="hero-image" aria-hidden="true"/><div className="hero-overlay" aria-hidden="true"/>
      <div className="container hero-content">
        <div className="eyebrow"><span className="eyebrow-dot"/> A clearer way to give</div>
        <h1>Make generosity<br/><em>go further.</em></h1>
        <p className="hero-text">Discover community needs, support organizations, and follow each donation journey in one place.</p>
        <div className="hero-actions"><Link to="/requests" className="btn btn-light">Explore causes <ArrowRight size={17}/></Link><Link to="/register" className="text-link hero-login">Create an account</Link></div>
        <div className="hero-proof"><span><ShieldCheck size={16}/> Human-reviewed organizations</span><span><HeartHandshake size={16}/> Donations tracked in one place</span></div>
        <div className="hero-caption">COMMUNITY · CARE · CONNECTION</div>
      </div>
    </section>

    <section className="trust-strip"><div className="container trust-items">
      <div><ShieldCheck/><span><strong>Reviewed with care</strong><small>Admin review for NGO profiles</small></span></div>
      <div><MapPin/><span><strong>Community needs</strong><small>Requests from local organizations</small></span></div>
      <div><HandHeart/><span><strong>Give your way</strong><small>Money or useful goods</small></span></div>
      <div><CheckCircle2/><span><strong>Follow progress</strong><small>See donation status updates</small></span></div>
    </div></section>

    <section className="section intro-section" id="how-it-works"><div className="container">
      <div className="intro-grid"><div><div className="eyebrow eyebrow-green">HOW IT WORKS</div><h2>Giving feels better<br/>when the next step is clear.</h2></div><div className="intro-copy"><p>DonationConnect brings donors and community organizations together. Explore requests, choose how to help and keep track of the pledge.</p><Link to="/requests" className="text-link">Browse community requests <ArrowRight size={16}/></Link></div></div>
      <div className="steps-grid">
        <article className="step-card"><span className="step-number">01</span><div className="step-icon"><BookOpen/></div><h3>Find a need</h3><p>Browse published requests by cause and learn what an organization is asking for.</p><div className="step-label">EXPLORE</div></article>
        <article className="step-card"><span className="step-number">02</span><div className="step-icon"><HandHeart/></div><h3>Make a pledge</h3><p>Choose a money or goods pledge that fits the request and your role.</p><div className="step-label">CONTRIBUTE</div></article>
        <article className="step-card"><span className="step-number">03</span><div className="step-icon"><PackageCheck/></div><h3>Follow the journey</h3><p>Check status updates from your dashboard as the donation moves forward.</p><div className="step-label">STAY CONNECTED</div></article>
      </div>
    </div></section>

    <section className="section causes-section" id="causes"><div className="container">
      <div className="section-heading"><div><div className="eyebrow eyebrow-green">EXPLORE CAUSES</div><h2>Small acts can make<br/><em>a meaningful difference.</em></h2></div><Link to="/requests" className="text-link">See all requests <ArrowRight size={16}/></Link></div>
      <div className="cause-grid">{causes.map(cause => <article className="cause-card" key={cause.title}><div className="cause-photo"><img src={cause.image} alt="" loading="lazy"/><span className="cause-tag">{cause.category}</span></div><div className="cause-body"><h3>{cause.title}</h3><p>{cause.description}</p><Link to="/requests" className="text-link">Explore requests <ArrowRight size={15}/></Link></div></article>)}</div>
    </div></section>

    <section className="section trust-section" id="trust"><div className="container trust-grid">
      <div className="trust-visual"><img src="https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=1100&q=85" alt="Community volunteers working together" loading="lazy"/><div className="trust-stamp"><ShieldCheck size={22}/><span><strong>People first</strong><small>Human review matters</small></span></div></div>
      <div className="trust-copy"><div className="eyebrow eyebrow-green">TRUST & TRANSPARENCY</div><h2>Built around thoughtful giving.</h2><p>Organizations submit profiles and requests for admin review. Donors can see request details and follow updates on their pledges.</p><ul className="trust-list"><li><ShieldCheck/> NGO profiles go through an admin review workflow.</li><li><UsersRound/> Donors choose from published community requests.</li><li><CheckCircle2/> Donation status updates stay visible in the app.</li></ul><p className="trust-note">For this project demo, sample organizations and requests should be clearly labeled as fictional. The app does not independently verify an organization or confirm a payment.</p><Link to="/requests" className="btn btn-primary">Explore requests <ArrowRight size={16}/></Link></div>
    </div></section>

    <section className="cta-section"><div className="container cta-inner"><div className="cta-mark"><HeartHandshake size={28}/></div><div><div className="eyebrow">DONATIONCONNECT</div><h2>Find a way to help today.</h2><p>Explore community requests and see how the platform works.</p></div><Link to="/requests" className="btn btn-light">Explore causes <ArrowRight size={16}/></Link><span className="cta-decoration" aria-hidden="true">kindness</span></div></section>
  </main>;
}
