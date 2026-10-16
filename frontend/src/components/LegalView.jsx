import React, { useState, useEffect } from 'react';
import { Shield, ShieldCheck, FileText, Trash2, AlertTriangle, ArrowLeft, CheckCircle2, UserCheck, Download, ArrowUp, RotateCcw } from 'lucide-react';
import { useStore } from '../store';

export default function LegalView({ initialTab = 'privacy', onBack }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const user = useStore(state => state.user);
  const submitDataRightsRequest = useStore(state => state.submitDataRightsRequest);
  const downloadDataExport = useStore(state => state.downloadDataExport);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const handleSelectTab = (tab) => {
    setActiveTab(tab);
    if (!onBack && typeof window !== 'undefined') {
      const tabUrlMap = {
        'privacy': '/privacy-policy',
        'terms': '/terms',
        'refund': '/refund-policy',
        'data-rights': '/data-rights',
        'delete-account': '/delete-account',
        'risk': '/risk-policy',
        'accessibility': '/accessibility'
      };
      const tabTitleMap = {
        'privacy': 'Privacy Policy | SkandX',
        'terms': 'Terms of Service | SkandX',
        'refund': 'Cancellation & Refund Policy | SkandX',
        'data-rights': 'Data Principal Rights Portal (DPDP Act) | SkandX',
        'delete-account': 'Request Account Deletion & Data Purge | SkandX',
        'risk': 'Risk Disclosure Document | SkandX',
        'accessibility': 'Accessibility Statement | SkandX'
      };
      const nextUrl = tabUrlMap[tab] || '/privacy-policy';
      if (window.location.pathname !== nextUrl) {
        window.history.replaceState(null, '', nextUrl);
      }
      if (tabTitleMap[tab]) {
        document.title = tabTitleMap[tab];
      }
    }
  };

  // Deletion Form State
  const [deleteEmail, setDeleteEmail] = useState(user?.email || '');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteSubmitted, setDeleteSubmitted] = useState(false);
  const [deleteRequestId, setDeleteRequestId] = useState('');

  // Data Rights Request State
  const [rightsEmail, setRightsEmail] = useState(user?.email || '');
  const [requestType, setRequestType] = useState('ACCESS');
  const [rightsDetails, setRightsDetails] = useState('');
  const [rightsSubmitting, setRightsSubmitting] = useState(false);
  const [rightsResponse, setRightsResponse] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);

  // Scroll Progress & Back-to-Top
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight > 0) {
        const scrolled = window.scrollY;
        setScrollProgress(Math.min(100, Math.max(0, (scrolled / scrollHeight) * 100)));
        setShowBackToTop(scrolled > 260);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteRequest = async (e) => {
    e.preventDefault();
    if (!deleteEmail.trim()) return;
    if (typeof submitDataRightsRequest === 'function') {
      const res = await submitDataRightsRequest(deleteEmail.trim(), 'ERASURE', deleteReason);
      if (res && res.request_id) {
        setDeleteRequestId(res.request_id);
      }
    }
    setDeleteSubmitted(true);
  };

  const handleRightsSubmit = async (e) => {
    e.preventDefault();
    if (!rightsEmail.trim()) return;
    setRightsSubmitting(true);
    try {
      const res = await submitDataRightsRequest(rightsEmail.trim(), requestType, rightsDetails);
      if (res && res.success) {
        setRightsResponse(res);
      } else {
        alert(res?.error || 'Failed to submit request');
      }
    } catch (err) {
      alert(err.message || 'Error submitting data rights request');
    } finally {
      setRightsSubmitting(false);
    }
  };

  const handleInstantExport = async () => {
    setExportLoading(true);
    try {
      await downloadDataExport();
    } catch (e) {
      alert('Could not generate export. Please log in or submit a formal access request below.');
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0d14',
      color: '#f3f4f6',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '24px 16px',
      position: 'relative'
    }}>
      {/* Reading Scroll Progress Bar */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: `${scrollProgress}%`,
          height: '3px',
          background: 'linear-gradient(90deg, #10b981 0%, #38bdf8 100%)',
          zIndex: 9999,
          boxShadow: '0 0 8px rgba(56, 189, 248, 0.6)',
          transition: 'width 0.1s ease-out'
        }} 
      />

      <div style={{ maxWidth: '880px', margin: '0 auto' }}>
        
        {/* Navigation & Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          {onBack ? (
            <button
              onClick={onBack}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                color: '#10b981',
                background: 'transparent',
                border: 'none',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                padding: 0
              }}
            >
              <ArrowLeft size={18} /> Back to Terminal
            </button>
          ) : (
            <a href="/" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              color: '#10b981',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              <ArrowLeft size={18} /> Back to SkandX
            </a>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px', fontWeight: '800', color: '#10b981', letterSpacing: '0.5px' }}>SkandX</span>
            <span style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' }}>Legal & Privacy Governance</span>
          </div>
        </div>

        {/* Tab Buttons */}
        <div style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '8px',
          marginBottom: '28px',
          borderBottom: '1px solid #1f2937'
        }}>
          <button
            onClick={() => handleSelectTab('privacy')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13.5px',
              fontWeight: '600',
              backgroundColor: activeTab === 'privacy' ? '#10b981' : '#111827',
              color: activeTab === 'privacy' ? '#000' : '#9ca3af',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            <Shield size={16} /> Privacy Notice
          </button>

          <button
            onClick={() => handleSelectTab('terms')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13.5px',
              fontWeight: '600',
              backgroundColor: activeTab === 'terms' ? '#10b981' : '#111827',
              color: activeTab === 'terms' ? '#000' : '#9ca3af',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            <FileText size={16} /> Terms of Service
          </button>

          <button
            onClick={() => handleSelectTab('refund')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13.5px',
              fontWeight: '600',
              backgroundColor: activeTab === 'refund' ? '#10b981' : '#111827',
              color: activeTab === 'refund' ? '#000' : '#9ca3af',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            <RotateCcw size={16} /> Cancellation & Refund
          </button>

          <button
            onClick={() => handleSelectTab('data-rights')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13.5px',
              fontWeight: '600',
              backgroundColor: activeTab === 'data-rights' ? '#3b82f6' : '#111827',
              color: activeTab === 'data-rights' ? '#fff' : '#9ca3af',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            <UserCheck size={16} /> Data Rights (DPDP)
          </button>

          <button
            onClick={() => handleSelectTab('delete-account')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13.5px',
              fontWeight: '600',
              backgroundColor: activeTab === 'delete-account' ? '#ef4444' : '#111827',
              color: activeTab === 'delete-account' ? '#fff' : '#9ca3af',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            <Trash2 size={16} /> Account Deletion
          </button>

          <button
            onClick={() => handleSelectTab('risk')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13.5px',
              fontWeight: '600',
              backgroundColor: activeTab === 'risk' ? '#f59e0b' : '#111827',
              color: activeTab === 'risk' ? '#000' : '#9ca3af',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            <AlertTriangle size={16} /> Risk Disclosure
          </button>

          <button
            onClick={() => handleSelectTab('accessibility')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13.5px',
              fontWeight: '600',
              backgroundColor: activeTab === 'accessibility' ? '#38bdf8' : '#111827',
              color: activeTab === 'accessibility' ? '#000' : '#9ca3af',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            <CheckCircle2 size={16} /> Accessibility
          </button>
        </div>

        {/* Content Panel */}
        <div style={{
          backgroundColor: '#111827',
          border: '1px solid #1f2937',
          borderRadius: '12px',
          padding: '32px 28px',
          lineHeight: '1.7',
          color: '#d1d5db',
          fontSize: '14px'
        }}>

          {/* TAB 1: PRIVACY POLICY & NOTICE */}
          {activeTab === 'privacy' && (
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#fff', marginBottom: '4px' }}>
                Privacy Notice & Data Protection Policy
              </h1>
              <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '24px' }}>
                Effective Date: October 1, 2026 | Last Updated: October 2026 | Version: v2026.1
              </p>

              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginTop: '24px' }}>1. Introduction & Data Fiduciary Details</h2>
              <p>
                SkandX ("SkandX", "we", "our", or "us"), operating the web trading terminal at <strong>https://skandx.in</strong> and the <strong>SkandX Mobile Applications</strong>, acts as the <strong>Data Fiduciary</strong> in respect of your personal data as defined under the Digital Personal Data Protection Act, 2023.
              </p>

              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginTop: '24px' }}>2. Personal Data We Collect</h2>
              <p>We process only such personal data as is strictly necessary for specified, lawful purposes:</p>
              <div style={{ overflowX: 'auto', marginTop: '12px', marginBottom: '16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.04)', color: '#fff', borderBottom: '1px solid #374151' }}>
                      <th style={{ padding: '10px' }}>Category</th>
                      <th style={{ padding: '10px' }}>Specific Data Elements</th>
                      <th style={{ padding: '10px' }}>Collection Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px', color: '#fff', fontWeight: '600' }}>Identity & Contact</td>
                      <td style={{ padding: '10px' }}>Full Name, Email Address, Mobile Phone Number, Profile Photo</td>
                      <td style={{ padding: '10px' }}>Direct user submission upon registration</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px', color: '#fff', fontWeight: '600' }}>Regulatory & KYC</td>
                      <td style={{ padding: '10px' }}>PAN Card Number, Aadhaar Details, Identity Document Scans, Residential Address</td>
                      <td style={{ padding: '10px' }}>Direct user submission during KYC compliance</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px', color: '#fff', fontWeight: '600' }}>Banking & Financial</td>
                      <td style={{ padding: '10px' }}>Bank Account Number, IFSC Code, UPI ID, Cashfree Transaction Reference IDs</td>
                      <td style={{ padding: '10px' }}>Subscription & contest reward processing</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px', color: '#fff', fontWeight: '600' }}>Simulation & Activity</td>
                      <td style={{ padding: '10px' }}>Simulated paper order history, virtual positions, virtual P&L, trading journal entries</td>
                      <td style={{ padding: '10px' }}>Generated through educational paper trading simulator</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '10px', color: '#fff', fontWeight: '600' }}>Technical & Security</td>
                      <td style={{ padding: '10px' }}>Public IP Address, User-Agent, Device Model, Browser/OS Version, Approximate City/State</td>
                      <td style={{ padding: '10px' }}>Automated session headers for fraud prevention</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginTop: '24px' }}>3. Lawful Basis and Purpose of Processing</h2>
              <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
                <li><strong>Contractual Performance:</strong> Providing educational market structure analytics, options chain study tools, virtual paper trading simulations, and software access.</li>
                <li><strong>Statutory & Regulatory Obligations:</strong> Compliance with the Digital Personal Data Protection (DPDP) Act, 2023, Information Technology Act, 2000, and applicable Indian tax laws.</li>
                <li><strong>Security & Legitimate Use:</strong> Detecting multi-accounting, preventing unauthorized brute-force logins, enforcing database locks, and maintaining system audit logs.</li>
                <li><strong>Explicit Consent:</strong> Optional product announcements, educational study notes, and performance telemetry (can be withdrawn at any time).</li>
              </ul>
              <p style={{ fontWeight: '700', color: '#10b981', marginTop: '8px' }}>
                SkandX NEVER sells, monetizes, or rents personal data to third-party advertising brokers.
              </p>

              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginTop: '24px' }}>4. Data Retention Schedule</h2>
              <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
                <li><strong>Active User Accounts:</strong> Maintained for the lifetime of your active platform membership.</li>
                <li><strong>Subscription & Billing Ledgers:</strong> Retained for a mandatory statutory duration of <strong>8 years</strong> under applicable Indian tax and accounting record-keeping rules.</li>
                <li><strong>Session & Security Logs:</strong> Retained on a rolling 180-day window in compliance with CERT-In directions.</li>
                <li><strong>Deactivated Accounts:</strong> Personal identification data is erased following statutory audit clearances, subject to mandatory regulatory retention requirements.</li>
              </ul>

              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginTop: '24px' }}>5. Third-Party Disclosures & Cloud Processors</h2>
              <p>We work exclusively with ISO-27001 and SOC-2 compliant technical data processors:</p>
              <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
                <li><strong>Google Cloud Platform & Firebase:</strong> VPC infrastructure hosting, PostgreSQL storage, and SMS One-Time Passwords.</li>
                <li><strong>Cashfree Payments India Pvt. Ltd.:</strong> RBI-authorized Payment Aggregator and PCI-DSS Level 1 certified payment gateway (card/UPI credentials are never stored on SkandX servers).</li>
                <li><strong>Market Data Providers:</strong> Authorized data feeds for delayed/educational market chart visualization.</li>
              </ul>

              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginTop: '24px' }}>6. Data Principal Rights (Under DPDP Act 2023 & GDPR)</h2>
              <p>As a Data Principal, you are entitled to:</p>
              <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
                <li><strong>Right to Access & Portability:</strong> Obtain a digital summary and structured JSON copy of all personal data processed by SkandX.</li>
                <li><strong>Right to Correction:</strong> Update inaccurate or incomplete KYC, bank details, or contact info.</li>
                <li><strong>Right to Erasure ("Right to be Forgotten"):</strong> Request complete deletion of your account and personal identifiers (subject to statutory financial ledger retention).</li>
                <li><strong>Right of Grievance Redressal:</strong> Timely resolution of privacy concerns through our Grievance Redressal Officer.</li>
                <li><strong>Right to Nominate:</strong> Designate a representative in the event of death or incapacity.</li>
                <li><strong>Right to Withdraw Consent:</strong> Withdraw opt-in consent for non-essential notifications and analytics.</li>
              </ul>

              {/* Grievance Officer Card */}
              <div style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '10px',
                padding: '20px',
                marginTop: '32px'
              }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '700', color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={20} /> Grievance Redressal Officer & Data Protection Contact
                </h3>
                <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#d1d5db' }}>
                  In accordance with Section 13 of the Digital Personal Data Protection Act, 2023, you may contact our designated Grievance Officer for privacy inquiries or rights enforcement:
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: '#9ca3af' }}>Name:</span><br />
                    <strong style={{ color: '#fff' }}>Hari Krishnan I V</strong>
                  </div>
                  <div>
                    <span style={{ color: '#9ca3af' }}>Official Email & Phone:</span><br />
                    <a href="mailto:skandx.in@gmail.com" style={{ color: '#10b981', textDecoration: 'none', fontWeight: '600' }}>skandx.in@gmail.com</a>
                    <span style={{ color: '#6b7280' }}> • </span>
                    <a href="tel:+919497861379" style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: '600' }}>+919497861379</a>
                  </div>
                  <div>
                    <span style={{ color: '#9ca3af' }}>Office Address:</span><br />
                    <span style={{ color: '#fff' }}>SkandX, Trivandrum, Kerala</span>
                  </div>
                  <div>
                    <span style={{ color: '#9ca3af' }}>Statutory Response SLA:</span><br />
                    <span style={{ color: '#fff' }}>Acknowledgment within <strong>24 hours</strong>; resolution within <strong>30 days</strong></span>
                  </div>
                </div>
                <div style={{ marginTop: '14px', fontSize: '12px', color: '#9ca3af', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                  If your grievance remains unaddressed within 30 days, you retain the statutory right to escalate directly to the <strong>Data Protection Board of India (DPBI)</strong> at <a href="https://dpbi.gov.in" target="_blank" rel="noreferrer" style={{ color: '#10b981' }}>https://dpbi.gov.in</a>.
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TERMS OF SERVICE */}
          {activeTab === 'terms' && (
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#fff', marginBottom: '8px' }}>
                Terms and Conditions of Use
              </h1>
              <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '24px' }}>
                Effective Date: October 1, 2026 | Last Updated: October 2026
              </p>

              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginTop: '20px' }}>1. Acceptance of Terms</h2>
              <p>
                By accessing or using the SkandX website (https://skandx.in), our mobile applications, or software tools, you agree to be bound by these Terms of Service. If you do not agree to these terms in full, you must discontinue platform use immediately.
              </p>

              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginTop: '20px' }}>2. Platform Nature, Regulatory Safeguards &amp; Non-Advisory Disclaimer</h2>
              <p>
                SkandX is strictly an <strong>educational virtual paper trading simulator, market analytics software, and financial literacy platform</strong>.
              </p>

              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '16px', marginTop: '12px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <strong style={{ color: '#10b981' }}>2.1 Explicit Risk &amp; Educational Disclaimers:</strong>
                  <div style={{ color: '#d1d5db', marginTop: '4px', fontStyle: 'italic' }}>
                    "SkandX is strictly an educational market simulation and financial calculation platform. We are not a SEBI-registered investment advisor, research analyst, or stockbroker. No financial advice, stock tips, buy/sell recommendations, or portfolio management services are provided."
                  </div>
                </div>
                <div>
                  <strong style={{ color: '#38bdf8' }}>2.2 No Fund Handling / Zero Escrow:</strong>
                  <div style={{ color: '#d1d5db', marginTop: '4px', fontStyle: 'italic' }}>
                    "Paper trading simulator uses virtual currency for educational purposes. All trading capital, margins, and P&amp;L are 100% virtual and hold no monetary value. SkandX does not accept, hold, or escrow public deposits or client investment funds."
                  </div>
                </div>
                <div>
                  <strong style={{ color: '#f59e0b' }}>2.3 Realistic Order Matching &amp; Institutional Volume Depth:</strong>
                  <div style={{ color: '#d1d5db', marginTop: '4px', fontStyle: 'italic' }}>
                    "SkandX is India's best paper trading app and web platform, featuring a proprietary real-time order matching engine with live tick pacing and realistic market volume matching. All simulated trades reflect real market liquidity depth and apply automated pre-trade risk checks, kill switches, and margin discipline with zero financial risk."
                  </div>
                </div>
              </div>

              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginTop: '20px' }}>3. User Responsibilities & Account Security</h2>
              <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
                <li>Users are responsible for safeguarding login credentials and OTP tokens.</li>
                <li>Users agree not to execute automated denial-of-service, quote scraping, or unauthorized API penetration attacks.</li>
                <li>Accounts detected engaging in manipulative spoofing or fraudulent identity manipulation will face immediate suspension.</li>
              </ul>

              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginTop: '20px' }}>4. Disclaimer of Warranties & System Availability</h2>
              <p>
                The service is delivered on an "AS IS" and "AS AVAILABLE" basis. SkandX is not liable for market slippage, exchange matching downtime, upstream network latency, or carrier SMS delivery delays.
              </p>

              {/* SECTION 5: DATA PROTECTION CLAUSE */}
              <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '20px', borderRadius: '10px', marginTop: '24px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#38bdf8', margin: '0 0 10px 0' }}>
                  5. Data Protection, Privacy & Information Security Clause
                </h2>
                <p style={{ margin: '0 0 10px 0', fontSize: '13.5px' }}>
                  <strong>5.1 Obligations of the Data Fiduciary:</strong> SkandX acts as a responsible Data Fiduciary under the Digital Personal Data Protection Act, 2023. We implement reasonable technical and organizational safeguards—including 256-bit TLS transit encryption, bcrypt password hashing, advisory transaction locking, and VPC firewalling—to safeguard user data against unauthorized access, destruction, or disclosure.
                </p>
                <p style={{ margin: '0 0 10px 0', fontSize: '13.5px' }}>
                  <strong>5.2 Data Principal Rights:</strong> Users maintain the right to access, review, port, and rectify their personal records, and to request account erasure in accordance with statutory rules. Requests may be lodged via our interactive Data Rights Portal, by emailing <a href="mailto:skandx.in@gmail.com" style={{ color: '#38bdf8' }}>skandx.in@gmail.com</a>, or by calling <a href="tel:+919497861379" style={{ color: '#38bdf8' }}>+919497861379</a>.
                </p>
                <p style={{ margin: '0 0 10px 0', fontSize: '13.5px' }}>
                  <strong>5.3 Security Incident Protocol:</strong> In the event of a verified personal data breach impacting user confidentiality, SkandX shall provide timely notification to the Data Protection Board of India and affected Data Principals in the form and manner prescribed by statutory law.
                </p>
                <p style={{ margin: 0, fontSize: '13.5px' }}>
                  <strong>5.4 Cross-Border Transfers:</strong> Personal data is processed primarily on secure Indian cloud availability zones. Any cross-border infrastructure relays comply strictly with government notifications and international adequacy safeguards.
                </p>
              </div>
            </div>
          )}

          {/* TAB: CANCELLATION & REFUND POLICY */}
          {activeTab === 'refund' && (
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#fff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <RotateCcw size={26} color="#10b981" /> Cancellation & Refund Policy
              </h1>
              <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '24px' }}>
                Effective Date: October 1, 2026 | Last Updated: October 2026 | Version: v2026.1
              </p>

              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '16px 20px', borderRadius: '10px', marginBottom: '24px' }}>
                <div style={{ color: '#10b981', fontWeight: '700', fontSize: '15px', marginBottom: '6px' }}>
                  🛡️ 7-Day Money-Back Guarantee for Digital Subscriptions
                </div>
                <div style={{ fontSize: '13.5px', color: '#d1d5db', lineHeight: '1.6' }}>
                  We want you to be completely confident using SkandX. If our platform, simulators, or analytics tools do not meet your expectations, first-time subscribers can request a <strong>100% full refund within 7 calendar days</strong> of payment. Duplicate or accidental charges are automatically refunded within 24–48 hours.
                </div>
              </div>

              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginTop: '24px' }}>
                1. Nature of Our Services & Free Access
              </h2>
              <p>
                SkandX (<strong>https://skandx.in</strong>) operates a specialized virtual paper trading simulator, financial educational tools, algorithmic trading bridges, and financial calculators.
              </p>
              <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
                <li><strong style={{ color: '#fff' }}>Free Tier:</strong> All users receive free access to simulated paper trading, virtual capital, charts, and public financial calculators without any payment obligation.</li>
                <li><strong style={{ color: '#fff' }}>Paid Subscriptions (Pro, Yearly, Lifetime, Masterclass):</strong> Optional premium tiers providing real-time low-latency market depth, algorithmic webhook bridges, extended watchlists, multi-broker connectivity, and NISM-curated educational masterclass cohorts.</li>
              </ul>

              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginTop: '24px' }}>
                2. Subscription Cancellation Policy
              </h2>
              <p>
                We believe in total freedom and user autonomy. You can cancel your subscription at any time without penalty or cancellation fees:
              </p>
              <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
                <li><strong style={{ color: '#fff' }}>Self-Service Cancellation:</strong> Navigate to your <strong>Account Profile / Settings</strong> (<code>/clientdata</code>) and toggle off recurring renewals with a single click.</li>
                <li><strong style={{ color: '#fff' }}>Assisted Cancellation:</strong> Send an email from your registered email address to <a href="mailto:skandx.in@gmail.com" style={{ color: '#10b981' }}>skandx.in@gmail.com</a> with the subject line <em>"Subscription Cancellation Request"</em>. Our support desk will process it within 24 hours.</li>
                <li><strong style={{ color: '#fff' }}>Effect of Cancellation:</strong> When you cancel, you will continue to enjoy full access to your paid tier benefits until the conclusion of your current billing cycle. After expiry, your account automatically transitions to the standard Free Tier with zero data loss.</li>
              </ul>

              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginTop: '24px' }}>
                3. Refund Eligibility & Refund Window
              </h2>
              <p>Refunds are evaluated under transparent guidelines:</p>
              <div style={{ overflowX: 'auto', marginTop: '12px', marginBottom: '16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.04)', color: '#fff', borderBottom: '1px solid #374151' }}>
                      <th style={{ padding: '10px' }}>Purchase Type</th>
                      <th style={{ padding: '10px' }}>Refund Window</th>
                      <th style={{ padding: '10px' }}>Eligibility & Conditions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px', color: '#fff', fontWeight: '600' }}>First-Time Subscription (Monthly / Yearly / Pro)</td>
                      <td style={{ padding: '10px', color: '#10b981', fontWeight: '700' }}>7 Calendar Days</td>
                      <td style={{ padding: '10px' }}>100% full refund. No questions asked if requested within 7 days from transaction timestamp.</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px', color: '#fff', fontWeight: '600' }}>Automatic Renewal Debits</td>
                      <td style={{ padding: '10px', color: '#38bdf8', fontWeight: '700' }}>48 Hours</td>
                      <td style={{ padding: '10px' }}>Full refund if reported within 48 hours of renewal debit, provided premium features were not actively utilized post-renewal.</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px', color: '#fff', fontWeight: '600' }}>Masterclass & Live Coaching Cohorts</td>
                      <td style={{ padding: '10px', color: '#f59e0b', fontWeight: '700' }}>Up to 48 Hours Before Batch Launch</td>
                      <td style={{ padding: '10px' }}>100% full refund before the first live lecture starts. Once live sessions commence and proprietary study vaults are unlocked, fees become non-refundable.</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '10px', color: '#fff', fontWeight: '600' }}>Lifetime Access License</td>
                      <td style={{ padding: '10px', color: '#10b981', fontWeight: '700' }}>7 Calendar Days</td>
                      <td style={{ padding: '10px' }}>Eligible for full refund within 7 days of initial activation.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginTop: '24px' }}>
                4. Duplicate Debits & Failed Payment Auto-Reversals
              </h2>
              <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
                <li><strong style={{ color: '#fff' }}>Duplicate Deductions:</strong> If your bank account or card is charged more than once for a single order due to network timeouts, the duplicate charge is identified by our payment gateway (Cashfree Payments) and auto-reversed within <strong>24 to 48 business hours</strong>.</li>
                <li><strong style={{ color: '#fff' }}>Payment Deducted But Plan Not Activated:</strong> If funds are debited from your bank/UPI but network disruption prevents instant activation, our automated reconciliation worker resolves this within 15 minutes. In the rare event of an unresolvable bank drop, the funds are automatically reversed by your issuing bank within <strong>3 to 5 business days</strong> in compliance with Reserve Bank of India (RBI) turnaround regulations.</li>
              </ul>

              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginTop: '24px' }}>
                5. Refund Payment Mode & Settlement Timelines
              </h2>
              <p>
                In compliance with anti-money laundering (AML) and banking standards:
              </p>
              <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
                <li>All refunds are issued <strong>strictly to the original source payment instrument</strong> (e.g. original UPI handle, debit/credit card, or net banking account). Cash refunds or transfers to alternate accounts are not permitted under any circumstances.</li>
                <li>Once approved by our billing team, the refund order is initiated via our payment gateway within <strong>24 hours</strong>.</li>
                <li>Depending on your issuing bank or card network (RuPay, Visa, Mastercard, NPCI), the credited funds will reflect on your statement within <strong>5 to 7 business days</strong>.</li>
              </ul>

              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginTop: '24px' }}>
                6. How to Request a Refund
              </h2>
              <p>To request a refund, follow these simple steps:</p>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '20px', borderRadius: '10px', marginTop: '12px' }}>
                <p style={{ margin: '0 0 10px 0' }}>
                  Send an email to our dedicated billing and customer grievance desk:
                </p>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#10b981', marginBottom: '12px' }}>
                  📧 <a href="mailto:skandx.in@gmail.com" style={{ color: '#10b981', textDecoration: 'none' }}>skandx.in@gmail.com</a>
                </div>
                <div style={{ fontSize: '13px', color: '#9ca3af', lineHeight: '1.6' }}>
                  Please include the following details for immediate same-day processing:
                  <ul style={{ paddingLeft: '20px', marginTop: '6px', color: '#d1d5db' }}>
                    <li><strong>Registered Email Address / Mobile Number</strong></li>
                    <li><strong>Order ID / Cashfree Reference ID / Bank UTR Number</strong></li>
                    <li><strong>Date & Amount of Transaction</strong></li>
                    <li><strong>Reason for Request</strong> (Optional — helps our engineering team improve)</li>
                  </ul>
                </div>
              </div>

              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginTop: '24px' }}>
                7. Official Compliance & Grievance Contact
              </h2>
              <p>
                For questions regarding billing, charge reconciliations, or cancellation assistance:
              </p>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '16px', borderRadius: '8px', marginTop: '12px' }}>
                <div>🏢 <strong>Merchant & Platform:</strong> SkandX</div>
                <div style={{ marginTop: '6px' }}>👤 <strong>Grievance & Compliance Officer:</strong> Hari Krishnan I V</div>
                <div style={{ marginTop: '6px' }}>📧 <strong>Official Email:</strong> <a href="mailto:skandx.in@gmail.com" style={{ color: '#10b981', textDecoration: 'none' }}>skandx.in@gmail.com</a></div>
                <div style={{ marginTop: '6px' }}>📞 <strong>Support Helpline:</strong> <a href="tel:+919497861379" style={{ color: '#38bdf8', textDecoration: 'none' }}>+919497861379</a> (Mon–Sat, 9:00 AM – 6:00 PM IST)</div>
                <div style={{ marginTop: '6px' }}>📍 <strong>Registered Office:</strong> SkandX, Trivandrum, Kerala, India</div>
              </div>
            </div>
          )}

          {/* TAB 3: DATA RIGHTS REQUEST FORM */}
          {activeTab === 'data-rights' && (
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#3b82f6', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <UserCheck size={28} /> Data Principal Rights Portal (DPDP Act, 2023)
              </h1>
              <p style={{ color: '#9ca3af', fontSize: '13.5px', marginBottom: '24px', lineHeight: '1.6' }}>
                Under Section 11, 12, and 13 of the Digital Personal Data Protection Act, 2023, you have the statutory right to request access, correction, erasure, or consent withdrawal for your personal data.
              </p>

              {/* Instant Export Card */}
              <div style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: '10px',
                padding: '20px',
                marginBottom: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px'
              }}>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#fff', fontWeight: '700' }}>
                    Instant Data Portability Export (Right to Access)
                  </h4>
                  <p style={{ margin: 0, fontSize: '12.5px', color: '#9ca3af' }}>
                    Instantly download an automated, machine-readable JSON copy of your profile, orders, positions, and consent logs.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleInstantExport}
                  disabled={exportLoading}
                  style={{
                    padding: '10px 18px',
                    background: '#3b82f6',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Download size={16} /> {exportLoading ? 'Generating Export...' : 'Download My Data (JSON)'}
                </button>
              </div>

              {rightsResponse ? (
                <div style={{
                  padding: '28px',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid #10b981',
                  borderRadius: '10px',
                  textAlign: 'center'
                }}>
                  <CheckCircle2 size={44} color="#10b981" style={{ margin: '0 auto 14px' }} />
                  <h3 style={{ color: '#10b981', margin: '0 0 8px 0', fontSize: '18px' }}>
                    Data Rights Request Officially Registered
                  </h3>
                  <p style={{ color: '#fff', fontSize: '15px', fontWeight: '700', margin: '8px 0' }}>
                    Reference Tracking ID: <span style={{ color: '#38bdf8' }}>{rightsResponse.request_id}</span>
                  </p>
                  <p style={{ color: '#d1d5db', fontSize: '13px', maxWidth: '580px', margin: '12px auto 0', lineHeight: '1.6' }}>
                    {rightsResponse.message} A copy of this ticket has been dispatched to <strong>{rightsEmail}</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setRightsResponse(null); setRightsDetails(''); }}
                    style={{ marginTop: '20px', padding: '8px 18px', background: '#1f2937', color: '#fff', border: '1px solid #374151', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}
                  >
                    Submit Another Request
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRightsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#f3f4f6' }}>
                      Registered Account Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={rightsEmail}
                      onChange={(e) => setRightsEmail(e.target.value)}
                      placeholder="trader@example.com"
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        backgroundColor: '#0a0d14',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#f3f4f6' }}>
                      Nature of Request *
                    </label>
                    <select
                      value={requestType}
                      onChange={(e) => setRequestType(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        backgroundColor: '#0a0d14',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    >
                      <option value="ACCESS">Right to Access / Summary of Personal Data (DPDP Sec. 11)</option>
                      <option value="CORRECTION">Right to Correction / Updating Inaccurate Data (DPDP Sec. 12)</option>
                      <option value="ERASURE">Right to Erasure / Right to be Forgotten (DPDP Sec. 12)</option>
                      <option value="WITHDRAW_CONSENT">Withdraw Processing / Marketing Consent (DPDP Sec. 6)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#f3f4f6' }}>
                      Request Specifics & Details (Optional)
                    </label>
                    <textarea
                      value={rightsDetails}
                      onChange={(e) => setRightsDetails(e.target.value)}
                      rows={4}
                      placeholder="Please describe which records you wish to review, correct, or erase..."
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        backgroundColor: '#0a0d14',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={rightsSubmitting}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#3b82f6',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      marginTop: '6px'
                    }}
                  >
                    {rightsSubmitting ? 'Registering Request...' : 'Submit Formal Data Rights Request'}
                  </button>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0' }}>
                    Requests are processed by the Grievance Redressal Officer in accordance with statutory DPDP rules.
                  </p>
                </form>
              )}
            </div>
          )}

          {/* TAB 4: ACCOUNT DELETION (Google Play Policy Requirement) */}
          {activeTab === 'delete-account' && (
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#ef4444', marginBottom: '8px' }}>
                Request Account Deletion & Data Purge
              </h1>
              <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '24px' }}>
                In compliance with Google Play Store User Data policies and the DPDP Act 2023, you can request the permanent erasure of your account and personal records.
              </p>

              <div style={{ backgroundColor: '#1f2937', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#f3f4f6', marginBottom: '8px' }}>
                  What happens when your account is deleted?
                </h3>
                <ul style={{ paddingLeft: '20px', margin: 0, color: '#9ca3af', fontSize: '13px' }}>
                  <li>Your user profile, login credentials, and session tokens are permanently erased.</li>
                  <li>Your KYC documents, uploaded PAN, and Aadhaar files are permanently purged.</li>
                  <li>Open orders will be cancelled. Regulatory trade ledger logs are retained only as required by applicable financial record-keeping laws (PMLA).</li>
                </ul>
              </div>

              {deleteSubmitted ? (
                <div style={{
                  padding: '24px',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid #10b981',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <CheckCircle2 size={40} color="#10b981" style={{ margin: '0 auto 12px' }} />
                  <h3 style={{ color: '#10b981', margin: '0 0 8px' }}>Deletion Request Received</h3>
                  {deleteRequestId && (
                    <div style={{ display: 'inline-block', padding: '4px 10px', backgroundColor: 'rgba(16, 185, 129, 0.15)', borderRadius: '6px', color: '#10b981', fontSize: '12px', fontWeight: '700', fontFamily: 'monospace', marginBottom: '10px' }}>
                      Reference ID: {deleteRequestId}
                    </div>
                  )}
                  <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>
                    Your request for <strong>{deleteEmail}</strong> has been logged and our admin team has been notified immediately. Our compliance team will 
                    verify and process your deletion within 48 business hours. You will receive a confirmation email once completed.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleDeleteRequest} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#f3f4f6' }}>
                      Registered Account Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={deleteEmail}
                      onChange={(e) => setDeleteEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        backgroundColor: '#0a0d14',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#f3f4f6' }}>
                      Reason for Deletion (Optional)
                    </label>
                    <textarea
                      value={deleteReason}
                      onChange={(e) => setDeleteReason(e.target.value)}
                      rows={3}
                      placeholder="Please let us know how we could have done better..."
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        backgroundColor: '#0a0d14',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#ef4444',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      marginTop: '8px'
                    }}
                  >
                    Submit Account Deletion Request
                  </button>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0' }}>
                    Alternatively, email us directly at <strong style={{ color: '#10b981' }}>skandx.in@gmail.com</strong> or call <a href="tel:+919497861379" style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: '600' }}>+919497861379</a> with the subject "Delete Account".
                  </p>
                </form>
              )}
            </div>
          )}

          {/* TAB 5: RISK DISCLOSURE */}
          {activeTab === 'risk' && (
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#f59e0b', marginBottom: '8px' }}>
                Risk Disclosure Document
              </h1>
              <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '24px' }}>
                Mandatory Risk Warning for Derivative & Equity Products
              </p>

              <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                <strong style={{ color: '#f59e0b' }}>⚠️ Standard Market / SEBI Risk Disclosure Notice:</strong>
                <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#d1d5db' }}>
                  9 out of 10 individual traders in equity Futures and Options Segment incur net losses. 
                  On average, loss makers registered net trading losses close to ₹50,000. 
                  Over and above net trading losses incurred, loss makers expended an additional 28% of net trading losses as transaction costs.
                </p>
              </div>

              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#f59e0b', marginTop: '20px' }}>1. Leverage Risk</h2>
              <p>
                Trading in leveraged contracts (Intraday & F&O) implies that small market movements can produce 
                disproportionate gains or losses. In fast-moving markets, your losses can exceed your initial deposited margin.
              </p>

              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#f59e0b', marginTop: '20px' }}>2. Technical Risks</h2>
              <p>
                Trading through electronic communication networks involves risks of internet connectivity loss, 
                latency, server disruptions, or delays in quote refreshes. SkandX implements automatic square-off 
                risk guardians, but traders should maintain independent stop-loss discipline.
              </p>

              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#f59e0b', marginTop: '20px' }}>3. Regulatory Safeguards &amp; Realistic Order Execution Model</h2>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '16px', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <strong style={{ color: '#fff' }}>Explicit Non-Advisory Protection:</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#d1d5db', fontStyle: 'italic' }}>
                    "SkandX is strictly an educational market simulation and financial calculation platform. We are not a SEBI-registered investment advisor, research analyst, or stockbroker."
                  </p>
                </div>
                <div>
                  <strong style={{ color: '#fff' }}>No Fund Handling / Zero Escrow:</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#d1d5db', fontStyle: 'italic' }}>
                    "Paper trading simulator uses virtual currency... All trading capital, margins, and P&amp;L are 100% virtual and hold no monetary value."
                  </p>
                </div>
                <div>
                  <strong style={{ color: '#fff' }}>Realistic Order Matching &amp; Institutional Volume Depth:</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#d1d5db', fontStyle: 'italic' }}>
                    "SkandX is India's best paper trading app and web platform, featuring a proprietary real-time order matching engine with live tick pacing and realistic market volume matching. All simulated trades reflect real market liquidity depth and apply automated pre-trade risk checks, kill switches, and margin discipline with zero financial risk."
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: ACCESSIBILITY STATEMENT */}
          {activeTab === 'accessibility' && (
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#fff', marginBottom: '8px' }}>
                Accessibility Statement & Digital Inclusion Policy
              </h1>
              <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '24px' }}>
                Commitment to Universal Web & Terminal Usability (WCAG 2.1 Level AA)
              </p>

              <div style={{ backgroundColor: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
                <strong style={{ color: '#38bdf8' }}>♿ Our Inclusive Trading Commitment:</strong>
                <p style={{ margin: '6px 0 0', fontSize: '13.5px', color: '#d1d5db', lineHeight: '1.6' }}>
                  SkandX is dedicated to providing an accessible, intuitive trading simulation environment for all users, 
                  including those with visual, auditory, physical, speech, cognitive, or neurological disabilities. 
                  Our digital interfaces strive to conform to the <strong>Web Content Accessibility Guidelines (WCAG) 2.1 Level AA</strong>.
                </p>
              </div>

              <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#38bdf8', marginTop: '24px', marginBottom: '10px' }}>
                1. High Contrast & Visual Comfort
              </h2>
              <p>
                The platform features a carefully calibrated high-contrast OLED dark theme with a compliant contrast ratio 
                exceeding 4.5:1 for standard text and 3:1 for large graphical components. Critical trading elements utilize 
                distinct, recognizable color cues complemented by text and icon badges to assist color-blind traders.
              </p>

              <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#38bdf8', marginTop: '24px', marginBottom: '10px' }}>
                2. Keyboard Execution & Navigation Hotkeys
              </h2>
              <p>
                Traders can navigate and operate the trading terminal without requiring a mouse. Built-in global keyboard shortcuts include:
              </p>
              <ul style={{ paddingLeft: '20px', margin: '10px 0 16px', lineHeight: '1.8' }}>
                <li><strong style={{ color: '#fff' }}>Shift + B:</strong> Instantly launch the Quick Buy Order modal for the active watchlist ticker.</li>
                <li><strong style={{ color: '#fff' }}>Shift + S:</strong> Instantly launch the Quick Sell Order modal for the active watchlist ticker.</li>
                <li><strong style={{ color: '#fff' }}>Escape (ESC):</strong> Close any open modal dialog or slide-over drawer immediately.</li>
                <li><strong style={{ color: '#fff' }}>Tab / Shift + Tab:</strong> Logical focus navigation across all interactive buttons and inputs.</li>
              </ul>

              <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#38bdf8', marginTop: '24px', marginBottom: '10px' }}>
                3. Screen Reader Compatibility & Assistive Tech
              </h2>
              <p>
                Interactive controls, modal dialogs, and form inputs are engineered with semantic HTML5 elements, descriptive 
                <code>aria-label</code> tags, and meaningful <code>alt</code> text attributes for screen reader compatibility (NVDA, JAWS, VoiceOver, and TalkBack).
              </p>

              <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#38bdf8', marginTop: '24px', marginBottom: '10px' }}>
                4. Feedback & Accessibility Grievance Support
              </h2>
              <p>
                We welcome suggestions to improve our usability. If you encounter any accessibility barrier or have questions, please reach out to our team:
              </p>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '16px', borderRadius: '8px', marginTop: '12px' }}>
                <div>👤 <strong>Contact Person:</strong> Hari Krishnan I V</div>
                <div style={{ marginTop: '6px' }}>📧 <strong>Accessibility Inquiries:</strong> <a href="mailto:skandx.in@gmail.com" style={{ color: '#38bdf8', textDecoration: 'none' }}>skandx.in@gmail.com</a></div>
                <div style={{ marginTop: '6px' }}>📞 <strong>Legal & Support Phone:</strong> <a href="tel:+919497861379" style={{ color: '#38bdf8', textDecoration: 'none' }}>+919497861379</a></div>
                <div style={{ marginTop: '6px' }}>🏢 <strong>Office Address:</strong> SkandX, Trivandrum, Kerala</div>
              </div>
            </div>
          )}

        </div>

        {/* Footer with Grievance Contact */}
        <div style={{ textAlign: 'center', marginTop: '32px', color: '#6b7280', fontSize: '12px', lineHeight: '1.8' }}>
          <div>&copy; 2026 SkandX. All rights reserved. | <a href="https://skandx.in" style={{ color: '#10b981', textDecoration: 'none' }}>https://skandx.in</a></div>
          <div>Grievance Redressal Officer: Hari Krishnan I V (<a href="mailto:skandx.in@gmail.com" style={{ color: '#10b981' }}>skandx.in@gmail.com</a> | <a href="tel:+919497861379" style={{ color: '#38bdf8', textDecoration: 'none' }}>+919497861379</a>) | SkandX, Trivandrum, Kerala</div>
        </div>

      </div>

      {/* Floating Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          aria-label="Back to top"
          style={{
            position: 'fixed',
            bottom: '28px',
            right: '28px',
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            border: '1px solid rgba(16, 185, 129, 0.5)',
            backdropFilter: 'blur(8px)',
            color: '#10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
            zIndex: 999,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#10b981';
            e.currentTarget.style.color = '#0a0d14';
            e.currentTarget.style.transform = 'translateY(-3px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
            e.currentTarget.style.color = '#10b981';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <ArrowUp size={20} />
        </button>
      )}
    </div>
  );
}
