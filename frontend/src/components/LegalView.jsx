import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  ShieldCheck, 
  FileText, 
  Trash2, 
  AlertTriangle, 
  ArrowLeft, 
  CheckCircle2, 
  UserCheck, 
  Download, 
  ArrowUp, 
  RotateCcw, 
  Truck, 
  PhoneCall, 
  Mail, 
  MapPin, 
  ChevronRight, 
  ExternalLink,
  Clock,
  Sparkles
} from 'lucide-react';
import { useStore } from '../store';

const LEGAL_TABS = [
  { id: 'privacy', label: 'Privacy Notice', icon: Shield, badge: 'DPDP Act 2023', description: 'Data protection, collection & rights' },
  { id: 'terms', label: 'Terms of Service', icon: FileText, badge: 'User Agreement', description: 'Platform usage, rules & disclaimers' },
  { id: 'refund', label: 'Cancellation & Refund', icon: RotateCcw, badge: '7-Day Guarantee', description: 'Refund eligibility & bank timelines' },
  { id: 'shipping', label: 'Shipping & Delivery', icon: Truck, badge: 'Instant Delivery', description: 'Cloud SaaS electronic fulfillment' },
  { id: 'contact', label: 'Contact Us', icon: PhoneCall, badge: 'Official Directory', description: 'Corporate entity, phones & address' },
  { id: 'data-rights', label: 'Data Rights (DPDP)', icon: UserCheck, badge: 'Statutory Portal', description: 'Export JSON data, access & corrections' },
  { id: 'delete-account', label: 'Account Deletion', icon: Trash2, badge: 'Account Purge', description: 'Permanent account & data erasure' },
  { id: 'risk', label: 'Risk Disclosure', icon: AlertTriangle, badge: 'SEBI Mandatory', description: 'F&O derivatives risk warnings' },
  { id: 'accessibility', label: 'Accessibility', icon: CheckCircle2, badge: 'WCAG 2.1 AA', description: 'Screen readers & execution hotkeys' },
];

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
        'shipping': '/shipping-policy',
        'contact': '/contact',
        'data-rights': '/data-rights',
        'delete-account': '/delete-account',
        'risk': '/risk-policy',
        'accessibility': '/accessibility'
      };
      const tabTitleMap = {
        'privacy': 'Privacy Policy | SkandX',
        'terms': 'Terms of Service | SkandX',
        'refund': 'Cancellation & Refund Policy | SkandX',
        'shipping': 'Shipping & Delivery Policy (Digital Services) | SkandX',
        'contact': 'Contact Us & Corporate Identification | SkandX',
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
      backgroundColor: '#f8fafc',
      color: '#0f172a',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif',
      padding: '24px 16px 64px',
      position: 'relative'
    }}>
      <style>{`
        .legal-page-layout {
          display: grid;
          grid-template-columns: 290px minmax(0, 1fr);
          gap: 28px;
          align-items: start;
        }
        .legal-sidebar {
          display: block;
          position: sticky;
          top: 24px;
        }
        .legal-mobile-nav {
          display: none;
        }
        .legal-hidden-scrollbar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .legal-hidden-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .legal-sidebar-btn {
          width: 100%;
          text-align: left;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid transparent;
          background: transparent;
          color: #475569;
          font-size: 13.5px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .legal-sidebar-btn:hover {
          background-color: #f1f5f9;
          color: #0f172a;
        }
        .legal-sidebar-btn.active {
          background-color: #0f172a;
          color: #ffffff;
          font-weight: 600;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);
        }
        .legal-sidebar-btn.active .sidebar-icon {
          color: #38bdf8;
        }
        .legal-sidebar-btn.active .sidebar-badge {
          background-color: rgba(255, 255, 255, 0.18);
          color: #ffffff;
        }
        .legal-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13.5px;
          text-align: left;
        }
        .legal-table th {
          background: #f8fafc;
          padding: 12px 14px;
          font-weight: 600;
          font-size: 12px;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid #e2e8f0;
        }
        .legal-table td {
          padding: 12px 14px;
          color: #334155;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: top;
        }
        .legal-table tr:hover td {
          background-color: #fafbfc;
        }
        .legal-input:focus {
          border-color: #2563eb !important;
          outline: none !important;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15) !important;
        }
        @media (max-width: 920px) {
          .legal-page-layout {
            display: block;
          }
          .legal-sidebar {
            display: none;
          }
          .legal-mobile-nav {
            display: block;
            margin-bottom: 24px;
          }
        }
      `}</style>

      {/* Reading Scroll Progress Bar */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: `${scrollProgress}%`,
          height: '3px',
          background: 'linear-gradient(90deg, #2563eb 0%, #06b6d4 100%)',
          zIndex: 9999,
          boxShadow: '0 1px 4px rgba(37, 99, 235, 0.25)',
          transition: 'width 0.1s ease-out'
        }} 
      />

      <div style={{ maxWidth: '1160px', margin: '0 auto' }}>
        
        {/* Top Header / Brand Bar */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          padding: '12px 0 24px', 
          borderBottom: '1px solid #e2e8f0', 
          marginBottom: '28px' 
        }}>
          {onBack ? (
            <button
              onClick={onBack}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                color: '#0f172a',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 0.15s ease'
              }}
            >
              <ArrowLeft size={16} color="#475569" /> Back to Terminal
            </button>
          ) : (
            <a 
              href="/" 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                color: '#0f172a',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                padding: '8px 14px',
                borderRadius: '8px',
                textDecoration: 'none',
                fontSize: '13.5px',
                fontWeight: '600',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <ArrowLeft size={16} color="#475569" /> Back to SkandX
            </a>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px' }}>
                Skand<span style={{ color: '#2563eb' }}>X</span>
              </span>
            </div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              padding: '4px 10px',
              borderRadius: '9999px',
              fontSize: '11.5px',
              fontWeight: '600',
              color: '#065f46'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#059669', display: 'inline-block' }}></span>
              Compliance Verified
            </div>
          </div>
        </div>

        {/* Mobile Navigation Header (<920px) */}
        <div className="legal-mobile-nav">
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '6px' }}>
              Select Legal Policy or Disclosure
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={activeTab}
                onChange={(e) => handleSelectTab(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  fontSize: '14.5px',
                  fontWeight: '600',
                  color: '#0f172a',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  cursor: 'pointer',
                  appearance: 'auto'
                }}
              >
                {LEGAL_TABS.map(tab => (
                  <option key={tab.id} value={tab.id}>
                    {tab.label} — {tab.badge}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Swipeable Pill Strip (Hidden native scrollbar) */}
          <div 
            className="legal-hidden-scrollbar"
            style={{
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              paddingBottom: '4px',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            {LEGAL_TABS.map(tab => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleSelectTab(tab.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '20px',
                    border: isActive ? '1px solid #0f172a' : '1px solid #e2e8f0',
                    backgroundColor: isActive ? '#0f172a' : '#ffffff',
                    color: isActive ? '#ffffff' : '#475569',
                    fontSize: '13px',
                    fontWeight: isActive ? '600' : '500',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    boxShadow: isActive ? '0 2px 8px rgba(15,23,42,0.12)' : '0 1px 2px rgba(0,0,0,0.03)'
                  }}
                >
                  <TabIcon size={14} color={isActive ? '#38bdf8' : '#64748b'} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2-Column Grid Layout */}
        <div className="legal-page-layout">

          {/* Left Sticky Sidebar (Desktop) */}
          <aside className="legal-sidebar">
            <div style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '16px',
              boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.04)'
            }}>
              <div style={{ padding: '6px 8px 14px', borderBottom: '1px solid #f1f5f9', marginBottom: '10px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#0f172a' }}>
                  Legal & Governance Hub
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  9 Statutory Documents & Disclosures
                </div>
              </div>

              <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {LEGAL_TABS.map(tab => {
                  const TabIcon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleSelectTab(tab.id)}
                      className={`legal-sidebar-btn ${isActive ? 'active' : ''}`}
                    >
                      <TabIcon size={16} className="sidebar-icon" style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                          <span style={{ truncate: 'true', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {tab.label}
                          </span>
                          <span 
                            className="sidebar-badge"
                            style={{
                              fontSize: '10px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: isActive ? 'rgba(255,255,255,0.18)' : '#f1f5f9',
                              color: isActive ? '#ffffff' : '#64748b',
                              fontWeight: '600'
                            }}
                          >
                            {tab.badge}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </nav>

              {/* Sidebar Quick Compliance Card */}
              <div style={{
                marginTop: '16px',
                padding: '14px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                fontSize: '12px',
                color: '#64748b',
                lineHeight: '1.5'
              }}>
                <div style={{ fontWeight: '700', color: '#0f172a', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={14} color="#059669" /> Grievance Redressal
                </div>
                <div>Statutory response window: <strong>24 hrs ack / 30 days fix</strong></div>
                <div style={{ marginTop: '6px' }}>
                  <a href="mailto:skandx.in@gmail.com" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: '600' }}>
                    skandx.in@gmail.com
                  </a>
                </div>
              </div>
            </div>
          </aside>

          {/* Right Main Document Card */}
          <main style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '36px 36px 48px',
            boxShadow: '0 4px 25px -4px rgba(15, 23, 42, 0.05), 0 2px 10px -2px rgba(15, 23, 42, 0.03)',
            minWidth: 0
          }}>

            {/* TAB 1: PRIVACY POLICY & NOTICE */}
            {activeTab === 'privacy' && (
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', marginBottom: '12px' }}>
                  <Shield size={14} /> Digital Personal Data Protection Act, 2023 Compliant
                </div>
                <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', marginBottom: '6px', letterSpacing: '-0.02em' }}>
                  Privacy Notice &amp; Data Protection Policy
                </h1>
                <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '24px' }}>
                  Effective Date: October 1, 2026 &nbsp;|&nbsp; Last Updated: October 2026 &nbsp;|&nbsp; Version: v2026.1
                </p>

                <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', marginTop: '28px', marginBottom: '10px' }}>
                  1. Introduction &amp; Data Fiduciary Details
                </h2>
                <p style={{ fontSize: '14.5px', lineHeight: '1.75', color: '#334155' }}>
                  SkandX ("SkandX", "we", "our", or "us"), operating the web trading terminal at <strong>https://skandx.in</strong> and the <strong>SkandX Mobile Applications</strong>, acts as the <strong>Data Fiduciary</strong> in respect of your personal data as defined under the Digital Personal Data Protection Act, 2023.
                </p>

                <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', marginTop: '28px', marginBottom: '10px' }}>
                  2. Personal Data We Collect
                </h2>
                <p style={{ fontSize: '14.5px', lineHeight: '1.75', color: '#334155' }}>
                  We process only such personal data as is strictly necessary for specified, lawful purposes:
                </p>
                <div style={{ overflowX: 'auto', marginTop: '12px', marginBottom: '20px', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                  <table className="legal-table">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Specific Data Elements</th>
                        <th>Collection Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ color: '#0f172a', fontWeight: '600' }}>Identity &amp; Contact</td>
                        <td>Full Name, Email Address, Mobile Phone Number, Profile Photo</td>
                        <td>Direct user submission upon registration</td>
                      </tr>
                      <tr>
                        <td style={{ color: '#0f172a', fontWeight: '600' }}>Regulatory &amp; KYC</td>
                        <td>PAN Card Number, Aadhaar Details, Identity Document Scans, Residential Address</td>
                        <td>Direct user submission during KYC compliance</td>
                      </tr>
                      <tr>
                        <td style={{ color: '#0f172a', fontWeight: '600' }}>Banking &amp; Financial</td>
                        <td>Bank Account Number, IFSC Code, UPI ID, Cashfree Transaction Reference IDs</td>
                        <td>Subscription &amp; contest reward processing</td>
                      </tr>
                      <tr>
                        <td style={{ color: '#0f172a', fontWeight: '600' }}>Simulation &amp; Activity</td>
                        <td>Simulated paper order history, virtual positions, virtual P&amp;L, trading journal entries</td>
                        <td>Generated through educational paper trading simulator</td>
                      </tr>
                      <tr>
                        <td style={{ color: '#0f172a', fontWeight: '600' }}>Technical &amp; Security</td>
                        <td>Public IP Address, User-Agent, Device Model, Browser/OS Version, Approximate City/State</td>
                        <td>Automated session headers for fraud prevention</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', marginTop: '28px', marginBottom: '10px' }}>
                  3. Lawful Basis and Purpose of Processing
                </h2>
                <ul style={{ paddingLeft: '22px', fontSize: '14.5px', lineHeight: '1.8', color: '#334155' }}>
                  <li><strong style={{ color: '#0f172a' }}>Contractual Performance:</strong> Providing educational market structure analytics, options chain study tools, virtual paper trading simulations, and software access.</li>
                  <li><strong style={{ color: '#0f172a' }}>Statutory &amp; Regulatory Obligations:</strong> Compliance with the Digital Personal Data Protection (DPDP) Act, 2023, Information Technology Act, 2000, and applicable Indian tax laws.</li>
                  <li><strong style={{ color: '#0f172a' }}>Security &amp; Legitimate Use:</strong> Detecting multi-accounting, preventing unauthorized brute-force logins, enforcing database locks, and maintaining system audit logs.</li>
                  <li><strong style={{ color: '#0f172a' }}>Explicit Consent:</strong> Optional product announcements, educational study notes, and performance telemetry (can be withdrawn at any time).</li>
                </ul>
                <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 16px', marginTop: '12px', fontSize: '14px', color: '#166534', fontWeight: '600' }}>
                  🛡️ SkandX NEVER sells, monetizes, or rents personal data to third-party advertising brokers.
                </div>

                <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', marginTop: '28px', marginBottom: '10px' }}>
                  4. Data Retention Schedule
                </h2>
                <ul style={{ paddingLeft: '22px', fontSize: '14.5px', lineHeight: '1.8', color: '#334155' }}>
                  <li><strong style={{ color: '#0f172a' }}>Active User Accounts:</strong> Maintained for the lifetime of your active platform membership.</li>
                  <li><strong style={{ color: '#0f172a' }}>Subscription &amp; Billing Ledgers:</strong> Retained for a mandatory statutory duration of <strong>8 years</strong> under applicable Indian tax and accounting record-keeping rules.</li>
                  <li><strong style={{ color: '#0f172a' }}>Session &amp; Security Logs:</strong> Retained on a rolling 180-day window in compliance with CERT-In directions.</li>
                  <li><strong style={{ color: '#0f172a' }}>Deactivated Accounts:</strong> Personal identification data is erased following statutory audit clearances, subject to mandatory regulatory retention requirements.</li>
                </ul>

                <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', marginTop: '28px', marginBottom: '10px' }}>
                  5. Third-Party Disclosures &amp; Cloud Processors
                </h2>
                <p style={{ fontSize: '14.5px', lineHeight: '1.75', color: '#334155' }}>
                  We work exclusively with ISO-27001 and SOC-2 compliant technical data processors:
                </p>
                <ul style={{ paddingLeft: '22px', fontSize: '14.5px', lineHeight: '1.8', color: '#334155' }}>
                  <li><strong style={{ color: '#0f172a' }}>Google Cloud Platform &amp; Firebase:</strong> VPC infrastructure hosting, PostgreSQL storage, and SMS One-Time Passwords.</li>
                  <li><strong style={{ color: '#0f172a' }}>Cashfree Payments India Pvt. Ltd.:</strong> RBI-authorized Payment Aggregator and PCI-DSS Level 1 certified payment gateway (card/UPI credentials are never stored on SkandX servers).</li>
                  <li><strong style={{ color: '#0f172a' }}>Market Data Providers:</strong> Authorized data feeds for delayed/educational market chart visualization.</li>
                </ul>

                <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', marginTop: '28px', marginBottom: '10px' }}>
                  6. Data Principal Rights (Under DPDP Act 2023 &amp; GDPR)
                </h2>
                <p style={{ fontSize: '14.5px', lineHeight: '1.75', color: '#334155' }}>
                  As a Data Principal, you are entitled to:
                </p>
                <ul style={{ paddingLeft: '22px', fontSize: '14.5px', lineHeight: '1.8', color: '#334155' }}>
                  <li><strong style={{ color: '#0f172a' }}>Right to Access &amp; Portability:</strong> Obtain a digital summary and structured JSON copy of all personal data processed by SkandX.</li>
                  <li><strong style={{ color: '#0f172a' }}>Right to Correction:</strong> Update inaccurate or incomplete KYC, bank details, or contact info.</li>
                  <li><strong style={{ color: '#0f172a' }}>Right to Erasure ("Right to be Forgotten"):</strong> Request complete deletion of your account and personal identifiers (subject to statutory financial ledger retention).</li>
                  <li><strong style={{ color: '#0f172a' }}>Right of Grievance Redressal:</strong> Timely resolution of privacy concerns through our Grievance Redressal Officer.</li>
                  <li><strong style={{ color: '#0f172a' }}>Right to Nominate:</strong> Designate a representative in the event of death or incapacity.</li>
                  <li><strong style={{ color: '#0f172a' }}>Right to Withdraw Consent:</strong> Withdraw opt-in consent for non-essential notifications and analytics.</li>
                </ul>

                {/* Grievance Officer Card */}
                <div style={{
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '12px',
                  padding: '24px',
                  marginTop: '32px'
                }}>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: '700', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={20} color="#15803d" /> Grievance Redressal Officer &amp; Data Protection Contact
                  </h3>
                  <p style={{ margin: '0 0 16px 0', fontSize: '13.5px', color: '#166534' }}>
                    In accordance with Section 13 of the Digital Personal Data Protection Act, 2023, you may contact our designated Grievance Officer for privacy inquiries or rights enforcement:
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', fontSize: '13px' }}>
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #dcfce7', borderRadius: '8px', padding: '12px' }}>
                      <span style={{ color: '#64748b', fontSize: '12px' }}>Legal Entity / Proprietor:</span><br />
                      <strong style={{ color: '#0f172a' }}>HARI KRISHNAN I VIJAYAN</strong>
                    </div>
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #dcfce7', borderRadius: '8px', padding: '12px' }}>
                      <span style={{ color: '#64748b', fontSize: '12px' }}>Official &amp; Support Email:</span><br />
                      <a href="mailto:h4harikrishnan2015@gmail.com" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: '600' }}>h4harikrishnan2015@gmail.com</a>
                      <span style={{ color: '#94a3b8' }}> • </span>
                      <a href="mailto:skandx.in@gmail.com" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: '600' }}>skandx.in@gmail.com</a>
                    </div>
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #dcfce7', borderRadius: '8px', padding: '12px' }}>
                      <span style={{ color: '#64748b', fontSize: '12px' }}>Helpline Phone:</span><br />
                      <a href="tel:+917306587969" style={{ color: '#0f172a', textDecoration: 'none', fontWeight: '600' }}>+91 7306587969</a>
                      <span style={{ color: '#94a3b8' }}> • </span>
                      <a href="tel:+919497861379" style={{ color: '#0f172a', textDecoration: 'none', fontWeight: '600' }}>+91 9497861379</a>
                    </div>
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #dcfce7', borderRadius: '8px', padding: '12px' }}>
                      <span style={{ color: '#64748b', fontSize: '12px' }}>Office Address:</span><br />
                      <span style={{ color: '#0f172a', fontWeight: '600' }}>SkandX, Trivandrum, Kerala - 695001, India</span>
                    </div>
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #dcfce7', borderRadius: '8px', padding: '12px' }}>
                      <span style={{ color: '#64748b', fontSize: '12px' }}>Statutory Response SLA:</span><br />
                      <span style={{ color: '#0f172a', fontWeight: '600' }}>Acknowledgment within <strong>24 hours</strong>; resolution within <strong>30 days</strong></span>
                    </div>
                  </div>
                  <div style={{ marginTop: '16px', fontSize: '12.5px', color: '#166534', borderTop: '1px solid #dcfce7', paddingTop: '12px' }}>
                    If your grievance remains unaddressed within 30 days, you retain the statutory right to escalate directly to the <strong>Data Protection Board of India (DPBI)</strong> at <a href="https://dpbi.gov.in" target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: '600' }}>https://dpbi.gov.in</a>.
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: TERMS OF SERVICE */}
            {activeTab === 'terms' && (
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', marginBottom: '12px' }}>
                  <FileText size={14} /> Legally Binding Master Agreement
                </div>
                <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', marginBottom: '6px', letterSpacing: '-0.02em' }}>
                  Terms and Conditions of Use
                </h1>
                <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '24px' }}>
                  Effective Date: October 1, 2026 &nbsp;|&nbsp; Last Updated: October 2026
                </p>

                <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', marginTop: '28px', marginBottom: '10px' }}>
                  1. Acceptance of Terms &amp; Corporate Identification
                </h2>
                <p style={{ fontSize: '14.5px', lineHeight: '1.75', color: '#334155' }}>
                  By accessing or using the SkandX website (https://skandx.in), our mobile applications, or software tools, you agree to be bound by these Terms of Service. SkandX is owned and operated by Sole Proprietor <strong>HARI KRISHNAN I VIJAYAN</strong>, having its principal registered office at SkandX, Trivandrum, Kerala - 695001, India (Official Email: <strong>h4harikrishnan2015@gmail.com</strong>, Helpline: <strong>+91 7306587969</strong> / <strong>+91 9497861379</strong>). If you do not agree to these terms in full, you must discontinue platform use immediately.
                </p>

                <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', marginTop: '28px', marginBottom: '10px' }}>
                  2. Platform Nature, Regulatory Safeguards &amp; Non-Advisory Disclaimer
                </h2>
                <p style={{ fontSize: '14.5px', lineHeight: '1.75', color: '#334155' }}>
                  SkandX is strictly an <strong>educational virtual paper trading simulator, market analytics software, and financial literacy platform</strong>.
                </p>

                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginTop: '16px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <strong style={{ color: '#0f172a', fontSize: '14px' }}>2.1 Explicit Risk &amp; Educational Disclaimers:</strong>
                    <div style={{ color: '#475569', marginTop: '4px', fontStyle: 'italic', fontSize: '14px', lineHeight: '1.6' }}>
                      "SkandX is strictly an educational market simulation and financial calculation platform. We are not a SEBI-registered investment advisor, research analyst, or stockbroker. No financial advice, stock tips, buy/sell recommendations, or portfolio management services are provided."
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                    <strong style={{ color: '#0f172a', fontSize: '14px' }}>2.2 No Fund Handling / Zero Escrow:</strong>
                    <div style={{ color: '#475569', marginTop: '4px', fontStyle: 'italic', fontSize: '14px', lineHeight: '1.6' }}>
                      "Paper trading simulator uses virtual currency for educational purposes. All trading capital, margins, and P&amp;L are 100% virtual and hold no monetary value. SkandX does not accept, hold, or escrow public deposits or client investment funds."
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                    <strong style={{ color: '#0f172a', fontSize: '14px' }}>2.3 Realistic Order Matching &amp; Institutional Volume Depth:</strong>
                    <div style={{ color: '#475569', marginTop: '4px', fontStyle: 'italic', fontSize: '14px', lineHeight: '1.6' }}>
                      "SkandX is India's best paper trading app and web platform, featuring a proprietary real-time order matching engine with live tick pacing and realistic market volume matching. All simulated trades reflect real market liquidity depth and apply automated pre-trade risk checks, kill switches, and margin discipline with zero financial risk."
                    </div>
                  </div>
                </div>

                <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', marginTop: '28px', marginBottom: '10px' }}>
                  3. User Responsibilities &amp; Account Security
                </h2>
                <ul style={{ paddingLeft: '22px', fontSize: '14.5px', lineHeight: '1.8', color: '#334155' }}>
                  <li>Users are responsible for safeguarding login credentials and OTP tokens.</li>
                  <li>Users agree not to execute automated denial-of-service, quote scraping, or unauthorized API penetration attacks.</li>
                  <li>Accounts detected engaging in manipulative spoofing or fraudulent identity manipulation will face immediate suspension.</li>
                </ul>

                <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', marginTop: '28px', marginBottom: '10px' }}>
                  4. Disclaimer of Warranties &amp; System Availability
                </h2>
                <p style={{ fontSize: '14.5px', lineHeight: '1.75', color: '#334155' }}>
                  The service is delivered on an "AS IS" and "AS AVAILABLE" basis. SkandX is not liable for market slippage, exchange matching downtime, upstream network latency, or carrier SMS delivery delays.
                </p>

                {/* Section 5: Data Protection Clause */}
                <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', padding: '24px', borderRadius: '12px', marginTop: '28px' }}>
                  <h2 style={{ fontSize: '16.5px', fontWeight: '700', color: '#1e40af', margin: '0 0 12px 0' }}>
                    5. Data Protection, Privacy &amp; Information Security Clause
                  </h2>
                  <p style={{ margin: '0 0 10px 0', fontSize: '14px', lineHeight: '1.7', color: '#1e3a8a' }}>
                    <strong>5.1 Obligations of the Data Fiduciary:</strong> SkandX acts as a responsible Data Fiduciary under the Digital Personal Data Protection Act, 2023. We implement reasonable technical and organizational safeguards—including 256-bit TLS transit encryption, bcrypt password hashing, advisory transaction locking, and VPC firewalling—to safeguard user data against unauthorized access, destruction, or disclosure.
                  </p>
                  <p style={{ margin: '0 0 10px 0', fontSize: '14px', lineHeight: '1.7', color: '#1e3a8a' }}>
                    <strong>5.2 Data Principal Rights:</strong> Users maintain the right to access, review, port, and rectify their personal records, and to request account erasure in accordance with statutory rules. Requests may be lodged via our interactive Data Rights Portal, by emailing <a href="mailto:skandx.in@gmail.com" style={{ color: '#2563eb', fontWeight: '600' }}>skandx.in@gmail.com</a>, or by calling <a href="tel:+919497861379" style={{ color: '#2563eb', fontWeight: '600' }}>+919497861379</a>.
                  </p>
                  <p style={{ margin: '0 0 10px 0', fontSize: '14px', lineHeight: '1.7', color: '#1e3a8a' }}>
                    <strong>5.3 Security Incident Protocol:</strong> In the event of a verified personal data breach impacting user confidentiality, SkandX shall provide timely notification to the Data Protection Board of India and affected Data Principals in the form and manner prescribed by statutory law.
                  </p>
                  <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.7', color: '#1e3a8a' }}>
                    <strong>5.4 Cross-Border Transfers:</strong> Personal data is processed primarily on secure Indian cloud availability zones. Any cross-border infrastructure relays comply strictly with government notifications and international adequacy safeguards.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 3: CANCELLATION & REFUND POLICY */}
            {activeTab === 'refund' && (
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', marginBottom: '12px' }}>
                  <RotateCcw size={14} color="#15803d" /> Transparent Consumer Protection Policy
                </div>
                <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', marginBottom: '6px', letterSpacing: '-0.02em' }}>
                  Cancellation &amp; Refund Policy
                </h1>
                <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '24px' }}>
                  Effective Date: October 1, 2026 &nbsp;|&nbsp; Last Updated: October 2026 &nbsp;|&nbsp; Version: v2026.1
                </p>

                <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '18px 22px', borderRadius: '12px', marginBottom: '28px' }}>
                  <div style={{ color: '#166534', fontWeight: '700', fontSize: '15px', marginBottom: '6px' }}>
                    🛡️ 7-Day Money-Back Guarantee for Digital Subscriptions
                  </div>
                  <div style={{ fontSize: '14px', color: '#14532d', lineHeight: '1.7' }}>
                    We want you to be completely confident using SkandX. If our platform, simulators, or analytics tools do not meet your expectations, first-time subscribers can request a <strong>100% full refund within 7 calendar days</strong> of payment. Duplicate or accidental charges are automatically refunded within 24–48 hours.
                  </div>
                </div>

                <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', marginTop: '28px', marginBottom: '10px' }}>
                  1. Nature of Our Services &amp; Free Access
                </h2>
                <p style={{ fontSize: '14.5px', lineHeight: '1.75', color: '#334155' }}>
                  SkandX (<strong>https://skandx.in</strong>) operates a specialized virtual paper trading simulator, financial educational tools, algorithmic trading bridges, and financial calculators.
                </p>
                <ul style={{ paddingLeft: '22px', fontSize: '14.5px', lineHeight: '1.8', color: '#334155' }}>
                  <li><strong style={{ color: '#0f172a' }}>Free Tier:</strong> All users receive free access to simulated paper trading, virtual capital, charts, and public financial calculators without any payment obligation.</li>
                  <li><strong style={{ color: '#0f172a' }}>Paid Subscriptions (Pro, Yearly, Lifetime, Masterclass):</strong> Optional premium tiers providing real-time low-latency market depth, algorithmic webhook bridges, extended watchlists, multi-broker connectivity, and NISM-curated educational masterclass cohorts.</li>
                </ul>

                <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', marginTop: '28px', marginBottom: '10px' }}>
                  2. Subscription Cancellation Policy
                </h2>
                <p style={{ fontSize: '14.5px', lineHeight: '1.75', color: '#334155' }}>
                  We believe in total freedom and user autonomy. You can cancel your subscription at any time without penalty or cancellation fees:
                </p>
                <ul style={{ paddingLeft: '22px', fontSize: '14.5px', lineHeight: '1.8', color: '#334155' }}>
                  <li><strong style={{ color: '#0f172a' }}>Self-Service Cancellation:</strong> Navigate to your <strong>Account Profile / Settings</strong> (<code>/clientdata</code>) and toggle off recurring renewals with a single click.</li>
                  <li><strong style={{ color: '#0f172a' }}>Assisted Cancellation:</strong> Send an email from your registered email address to <a href="mailto:skandx.in@gmail.com" style={{ color: '#2563eb', fontWeight: '600' }}>skandx.in@gmail.com</a> with the subject line <em>"Subscription Cancellation Request"</em>. Our support desk will process it within 24 hours.</li>
                  <li><strong style={{ color: '#0f172a' }}>Effect of Cancellation:</strong> When you cancel, you will continue to enjoy full access to your paid tier benefits until the conclusion of your current billing cycle. After expiry, your account automatically transitions to the standard Free Tier with zero data loss.</li>
                </ul>

                <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', marginTop: '28px', marginBottom: '10px' }}>
                  3. Refund Eligibility &amp; Refund Window
                </h2>
                <p style={{ fontSize: '14.5px', lineHeight: '1.75', color: '#334155' }}>Refunds are evaluated under transparent guidelines:</p>
                <div style={{ overflowX: 'auto', marginTop: '12px', marginBottom: '20px', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                  <table className="legal-table">
                    <thead>
                      <tr>
                        <th>Purchase Type</th>
                        <th>Refund Window</th>
                        <th>Eligibility &amp; Conditions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ color: '#0f172a', fontWeight: '600' }}>First-Time Subscription (Monthly / Yearly / Pro)</td>
                        <td style={{ color: '#16a34a', fontWeight: '700' }}>7 Calendar Days</td>
                        <td>100% full refund. No questions asked if requested within 7 days from transaction timestamp.</td>
                      </tr>
                      <tr>
                        <td style={{ color: '#0f172a', fontWeight: '600' }}>Automatic Renewal Debits</td>
                        <td style={{ color: '#2563eb', fontWeight: '700' }}>48 Hours</td>
                        <td>Full refund if reported within 48 hours of renewal debit, provided premium features were not actively utilized post-renewal.</td>
                      </tr>
                      <tr>
                        <td style={{ color: '#0f172a', fontWeight: '600' }}>Masterclass &amp; Live Coaching Cohorts</td>
                        <td style={{ color: '#d97706', fontWeight: '700' }}>Up to 48 Hours Before Batch Launch</td>
                        <td>100% full refund before the first live lecture starts. Once live sessions commence and proprietary study vaults are unlocked, fees become non-refundable.</td>
                      </tr>
                      <tr>
                        <td style={{ color: '#0f172a', fontWeight: '600' }}>Lifetime Access License</td>
                        <td style={{ color: '#16a34a', fontWeight: '700' }}>7 Calendar Days</td>
                        <td>Eligible for full refund within 7 days of initial activation.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', marginTop: '28px', marginBottom: '10px' }}>
                  4. Duplicate Debits &amp; Failed Payment Auto-Reversals
                </h2>
                <ul style={{ paddingLeft: '22px', fontSize: '14.5px', lineHeight: '1.8', color: '#334155' }}>
                  <li><strong style={{ color: '#0f172a' }}>Duplicate Deductions:</strong> If your bank account or card is charged more than once for a single order due to network timeouts, the duplicate charge is identified by our payment gateway (Cashfree Payments) and auto-reversed within <strong>24 to 48 business hours</strong>.</li>
                  <li><strong style={{ color: '#0f172a' }}>Payment Deducted But Plan Not Activated:</strong> If funds are debited from your bank/UPI but network disruption prevents instant activation, our automated reconciliation worker resolves this within 15 minutes. In the rare event of an unresolvable bank drop, the funds are automatically reversed by your issuing bank within <strong>3 to 5 business days</strong> in compliance with Reserve Bank of India (RBI) turnaround regulations.</li>
                </ul>

                <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', marginTop: '28px', marginBottom: '10px' }}>
                  5. Refund Payment Mode &amp; Settlement Timelines
                </h2>
                <p style={{ fontSize: '14.5px', lineHeight: '1.75', color: '#334155' }}>
                  In compliance with anti-money laundering (AML) and banking standards:
                </p>
                <ul style={{ paddingLeft: '22px', fontSize: '14.5px', lineHeight: '1.8', color: '#334155' }}>
                  <li>All refunds are issued <strong>strictly to the original source payment instrument</strong> (e.g. original UPI handle, debit/credit card, or net banking account). Cash refunds or transfers to alternate accounts are not permitted under any circumstances.</li>
                  <li>Once approved by our billing team, the refund order is initiated via our payment gateway within <strong>24 hours</strong>.</li>
                  <li>Depending on your issuing bank or card network (RuPay, Visa, Mastercard, NPCI), the credited funds will reflect on your statement within <strong>5 to 7 business days</strong>.</li>
                </ul>

                <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', marginTop: '28px', marginBottom: '10px' }}>
                  6. How to Request a Refund
                </h2>
                <p style={{ fontSize: '14.5px', lineHeight: '1.75', color: '#334155' }}>To request a refund, follow these simple steps:</p>
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '22px', borderRadius: '12px', marginTop: '12px' }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#334155' }}>
                    Send an email to our dedicated billing and customer grievance desk:
                  </p>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#2563eb', marginBottom: '12px' }}>
                    📧 <a href="mailto:skandx.in@gmail.com" style={{ color: '#2563eb', textDecoration: 'none' }}>skandx.in@gmail.com</a>
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.6' }}>
                    Please include the following details for immediate same-day processing:
                    <ul style={{ paddingLeft: '20px', marginTop: '8px', color: '#334155' }}>
                      <li><strong>Registered Email Address / Mobile Number</strong></li>
                      <li><strong>Order ID / Cashfree Reference ID / Bank UTR Number</strong></li>
                      <li><strong>Date &amp; Amount of Transaction</strong></li>
                      <li><strong>Reason for Request</strong> (Optional — helps our engineering team improve)</li>
                    </ul>
                  </div>
                </div>

                <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', marginTop: '28px', marginBottom: '10px' }}>
                  7. Official Compliance &amp; Grievance Contact
                </h2>
                <p style={{ fontSize: '14.5px', lineHeight: '1.75', color: '#334155' }}>
                  For questions regarding billing, charge reconciliations, or cancellation assistance:
                </p>
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '18px 20px', borderRadius: '12px', marginTop: '12px', fontSize: '13.5px', lineHeight: '1.8' }}>
                  <div>🏢 <strong>Merchant &amp; Legal Entity:</strong> SkandX (Sole Proprietor: HARI KRISHNAN I VIJAYAN)</div>
                  <div>👤 <strong>Grievance &amp; Compliance Officer:</strong> HARI KRISHNAN I VIJAYAN</div>
                  <div>📧 <strong>Official Email:</strong> <a href="mailto:h4harikrishnan2015@gmail.com" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: '600' }}>h4harikrishnan2015@gmail.com</a> (Support: <a href="mailto:skandx.in@gmail.com" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: '600' }}>skandx.in@gmail.com</a>)</div>
                  <div>📞 <strong>Support Helpline:</strong> <a href="tel:+917306587969" style={{ color: '#0f172a', textDecoration: 'none', fontWeight: '600' }}>+91 7306587969</a> / <a href="tel:+919497861379" style={{ color: '#0f172a', textDecoration: 'none', fontWeight: '600' }}>+91 9497861379</a> (Mon–Sat, 9:00 AM – 6:00 PM IST)</div>
                  <div>📍 <strong>Registered Office:</strong> SkandX, Trivandrum, Kerala - 695001, India</div>
                </div>
              </div>
            )}

            {/* TAB 4: SHIPPING & DELIVERY POLICY (DIGITAL SERVICES) */}
            {activeTab === 'shipping' && (
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', marginBottom: '12px' }}>
                  <Truck size={14} /> Digital Fulfillment SLA
                </div>
                <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', marginBottom: '6px', letterSpacing: '-0.02em' }}>
                  Shipping &amp; Delivery Policy (Digital Services)
                </h1>
                <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '24px' }}>
                  Effective Date: October 1, 2026 &nbsp;|&nbsp; Last Updated: October 2026
                </p>

                <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', padding: '18px 22px', borderRadius: '12px', marginBottom: '28px' }}>
                  <div style={{ color: '#1e40af', fontWeight: '700', fontSize: '15px', marginBottom: '6px' }}>
                    ⚡ 100% Instant Electronic Service Delivery
                  </div>
                  <div style={{ fontSize: '14px', color: '#1e3a8a', lineHeight: '1.7' }}>
                    SkandX operates strictly as a cloud-hosted software-as-a-service (SaaS) and educational virtual paper trading simulation platform. Since all products and services offered on <a href="https://skandx.in" style={{ color: '#2563eb', fontWeight: '600' }}>https://skandx.in</a> are purely digital, <strong>no physical shipping, packaging, or courier handling is required</strong>.
                  </div>
                </div>

                <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', marginTop: '28px', marginBottom: '10px' }}>
                  1. Digital Fulfillment &amp; Provisioning Process
                </h2>
                <p style={{ fontSize: '14.5px', lineHeight: '1.75', color: '#334155' }}>
                  All digital subscription plans, algorithmic terminal credits, and virtual paper trading demo margin allocations are fulfilled electronically:
                </p>
                <ul style={{ paddingLeft: '22px', fontSize: '14.5px', lineHeight: '1.8', color: '#334155' }}>
                  <li><strong style={{ color: '#0f172a' }}>Instant Activation:</strong> Upon successful transaction authorization by our payment gateway partner (Cashfree Payments India Pvt. Ltd.), your account is provisioned instantly within <strong>1 to 5 seconds</strong>.</li>
                  <li><strong style={{ color: '#0f172a' }}>Electronic Confirmation:</strong> An automated confirmation receipt containing the transaction reference ID, billing details, and subscription validity is immediately dispatched to your registered email address.</li>
                  <li><strong style={{ color: '#0f172a' }}>Direct In-App Delivery:</strong> Premium features, PRO calculators, and paper trading margin allowances become active immediately inside your dashboard without any manual intervention.</li>
                </ul>

                <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', marginTop: '28px', marginBottom: '10px' }}>
                  2. Shipping &amp; Handling Charges
                </h2>
                <p style={{ fontSize: '14.5px', lineHeight: '1.75', color: '#334155' }}>
                  Because delivery is executed entirely over secure electronic networks via the internet:
                </p>
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px 20px', marginTop: '12px' }}>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#16a34a' }}>₹0.00 Shipping Fees (Free Electronic Delivery)</div>
                  <p style={{ margin: '6px 0 0', fontSize: '13.5px', color: '#475569', lineHeight: '1.6' }}>
                    Zero (₹0) courier, freight, handling, or dispatch charges apply to any digital plan or product available on SkandX. The price displayed on the checkout page is the final all-inclusive price.
                  </p>
                </div>

                <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', marginTop: '28px', marginBottom: '10px' }}>
                  3. Delivery Delays &amp; Technical Support SLA
                </h2>
                <p style={{ fontSize: '14.5px', lineHeight: '1.75', color: '#334155' }}>
                  In rare events where upstream banking network latency delays the instant Cashfree payment webhook confirmation:
                </p>
                <ul style={{ paddingLeft: '22px', fontSize: '14.5px', lineHeight: '1.8', color: '#334155' }}>
                  <li>Please allow up to <strong>15 minutes</strong> for automated bank reconciliation and server-side verification.</li>
                  <li>If your account is not upgraded within 15 minutes, please contact our support team with your Cashfree Payment Reference ID or Bank UTR.</li>
                  <li>Our engineering desk will manually reconcile and provision your digital access within <strong>2 to 4 hours</strong> of ticket submission.</li>
                </ul>

                <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', marginTop: '28px', marginBottom: '10px' }}>
                  4. Corporate &amp; Delivery Support Contact
                </h2>
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '18px 20px', borderRadius: '12px', marginTop: '12px', fontSize: '13.5px', lineHeight: '1.8' }}>
                  <div>🏢 <strong>Merchant &amp; Legal Entity:</strong> SkandX (Sole Proprietor: HARI KRISHNAN I VIJAYAN)</div>
                  <div>👤 <strong>Fulfillment &amp; Compliance Officer:</strong> HARI KRISHNAN I VIJAYAN</div>
                  <div>📧 <strong>Official Email:</strong> <a href="mailto:h4harikrishnan2015@gmail.com" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: '600' }}>h4harikrishnan2015@gmail.com</a> (Support: <a href="mailto:skandx.in@gmail.com" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: '600' }}>skandx.in@gmail.com</a>)</div>
                  <div>📞 <strong>Support Helpline:</strong> <a href="tel:+917306587969" style={{ color: '#0f172a', textDecoration: 'none', fontWeight: '600' }}>+91 7306587969</a> / <a href="tel:+919497861379" style={{ color: '#0f172a', textDecoration: 'none', fontWeight: '600' }}>+91 9497861379</a> (Mon–Sat, 9:00 AM – 6:00 PM IST)</div>
                  <div>📍 <strong>Registered Office:</strong> SkandX, Trivandrum, Kerala - 695001, India</div>
                </div>
              </div>
            )}

            {/* TAB 5: CONTACT US & CORPORATE DETAILS */}
            {activeTab === 'contact' && (
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', marginBottom: '12px' }}>
                  <PhoneCall size={14} /> Official Merchant Directory
                </div>
                <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', marginBottom: '6px', letterSpacing: '-0.02em' }}>
                  Contact Us &amp; Corporate Identification
                </h1>
                <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '24px' }}>
                  Official Merchant Identity &amp; Statutory Support Directory
                </p>

                <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', padding: '18px 22px', borderRadius: '12px', marginBottom: '28px' }}>
                  <strong style={{ color: '#1e40af', fontSize: '15px' }}>🏢 Registered Sole Proprietorship:</strong>
                  <p style={{ margin: '6px 0 0', fontSize: '14px', color: '#1e3a8a', lineHeight: '1.6' }}>
                    SkandX is owned and managed by <strong>HARI KRISHNAN I VIJAYAN</strong> as an individual sole proprietorship operating educational market simulation technology and financial calculator software across India.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '28px' }}>
                  <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2563eb', fontWeight: '700', fontSize: '14.5px', marginBottom: '10px' }}>
                      <Mail size={18} /> Official Email Inquiries
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#64748b', marginBottom: '3px' }}>Primary Merchant Email:</div>
                    <a href="mailto:h4harikrishnan2015@gmail.com" style={{ color: '#0f172a', fontWeight: '600', textDecoration: 'none', fontSize: '13.5px' }}>h4harikrishnan2015@gmail.com</a>
                    <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '12px', marginBottom: '3px' }}>Customer Support Desk:</div>
                    <a href="mailto:skandx.in@gmail.com" style={{ color: '#2563eb', fontWeight: '600', textDecoration: 'none', fontSize: '13.5px' }}>skandx.in@gmail.com</a>
                  </div>

                  <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0284c7', fontWeight: '700', fontSize: '14.5px', marginBottom: '10px' }}>
                      <PhoneCall size={18} /> Phone Helpline &amp; WhatsApp
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#64748b', marginBottom: '3px' }}>Direct KYC &amp; Onboarding Phone:</div>
                    <a href="tel:+917306587969" style={{ color: '#0f172a', fontWeight: '600', textDecoration: 'none', fontSize: '13.5px' }}>+91 7306587969</a>
                    <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '12px', marginBottom: '3px' }}>Customer Support Helpline:</div>
                    <a href="tel:+919497861379" style={{ color: '#0284c7', fontWeight: '600', textDecoration: 'none', fontSize: '13.5px' }}>+91 9497861379</a>
                  </div>

                  <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#d97706', fontWeight: '700', fontSize: '14.5px', marginBottom: '10px' }}>
                      <MapPin size={18} /> Registered Office
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#64748b', marginBottom: '3px' }}>Physical Address:</div>
                    <div style={{ fontSize: '13.5px', color: '#0f172a', fontWeight: '600', lineHeight: '1.5' }}>
                      SkandX, Trivandrum, Kerala - 695001, India
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
                      Operational Hours: Monday to Saturday, 9:00 AM – 6:00 PM IST
                    </div>
                  </div>
                </div>

                <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', marginTop: '28px', marginBottom: '10px' }}>
                  Statutory Grievance Redressal Mechanism
                </h2>
                <p style={{ fontSize: '14.5px', lineHeight: '1.75', color: '#334155' }}>
                  In compliance with the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 and the Digital Personal Data Protection Act, 2023:
                </p>
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '18px 20px', borderRadius: '12px', marginTop: '12px', fontSize: '13.5px', lineHeight: '1.8' }}>
                  <div>👤 <strong>Grievance Officer:</strong> HARI KRISHNAN I VIJAYAN</div>
                  <div>📧 <strong>Email:</strong> <a href="mailto:h4harikrishnan2015@gmail.com" style={{ color: '#2563eb', fontWeight: '600' }}>h4harikrishnan2015@gmail.com</a> / <a href="mailto:skandx.in@gmail.com" style={{ color: '#2563eb', fontWeight: '600' }}>skandx.in@gmail.com</a></div>
                  <div>📞 <strong>Direct Phone:</strong> <a href="tel:+917306587969" style={{ color: '#0f172a', fontWeight: '600' }}>+91 7306587969</a> / <a href="tel:+919497861379" style={{ color: '#0f172a', fontWeight: '600' }}>+91 9497861379</a></div>
                  <div>⏱️ <strong>Resolution Turnaround:</strong> Acknowledgment within 24 hours; complete dispute resolution within 30 days.</div>
                </div>
              </div>
            )}

            {/* TAB 6: DATA RIGHTS (DPDP ACT 2023) */}
            {activeTab === 'data-rights' && (
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', marginBottom: '12px' }}>
                  <UserCheck size={14} /> Statutory DPDP Portal
                </div>
                <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', marginBottom: '6px', letterSpacing: '-0.02em' }}>
                  Data Principal Rights Portal (DPDP Act, 2023)
                </h1>
                <p style={{ color: '#64748b', fontSize: '13.5px', marginBottom: '24px', lineHeight: '1.6' }}>
                  Under Section 11, 12, and 13 of the Digital Personal Data Protection Act, 2023, you have the statutory right to request access, correction, erasure, or consent withdrawal for your personal data.
                </p>

                {/* Instant Export Card */}
                <div style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '20px 24px',
                  marginBottom: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '16px'
                }}>
                  <div style={{ maxWidth: '480px' }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>
                      Instant Data Portability Export (Right to Access)
                    </h4>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>
                      Instantly download an automated, machine-readable JSON copy of your profile, orders, positions, and consent logs.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleInstantExport}
                    disabled={exportLoading}
                    style={{
                      padding: '10px 18px',
                      backgroundColor: '#2563eb',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 2px 6px rgba(37,99,235,0.25)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Download size={16} /> {exportLoading ? 'Generating Export...' : 'Download My Data (JSON)'}
                  </button>
                </div>

                {rightsResponse ? (
                  <div style={{
                    padding: '32px 24px',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '12px',
                    textAlign: 'center'
                  }}>
                    <CheckCircle2 size={44} color="#16a34a" style={{ margin: '0 auto 12px' }} />
                    <h3 style={{ color: '#166534', margin: '0 0 8px 0', fontSize: '18px', fontWeight: '700' }}>
                      Data Rights Request Officially Registered
                    </h3>
                    <p style={{ color: '#0f172a', fontSize: '14.5px', fontWeight: '600', margin: '8px 0' }}>
                      Reference Tracking ID: <span style={{ color: '#2563eb', fontFamily: 'monospace' }}>{rightsResponse.request_id}</span>
                    </p>
                    <p style={{ color: '#334155', fontSize: '13px', maxWidth: '560px', margin: '12px auto 0', lineHeight: '1.6' }}>
                      {rightsResponse.message} A copy of this ticket has been dispatched to <strong>{rightsEmail}</strong>.
                    </p>
                    <button
                      type="button"
                      onClick={() => { setRightsResponse(null); setRightsDetails(''); }}
                      style={{
                        marginTop: '20px',
                        padding: '9px 20px',
                        backgroundColor: '#ffffff',
                        color: '#0f172a',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '600'
                      }}
                    >
                      Submit Another Request
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleRightsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#0f172a' }}>
                        Registered Account Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={rightsEmail}
                        onChange={(e) => setRightsEmail(e.target.value)}
                        placeholder="trader@example.com"
                        className="legal-input"
                        style={{
                          width: '100%',
                          padding: '11px 14px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          color: '#0f172a',
                          fontSize: '14px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#0f172a' }}>
                        Nature of Request *
                      </label>
                      <select
                        value={requestType}
                        onChange={(e) => setRequestType(e.target.value)}
                        className="legal-input"
                        style={{
                          width: '100%',
                          padding: '11px 14px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          color: '#0f172a',
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
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#0f172a' }}>
                        Request Specifics &amp; Details (Optional)
                      </label>
                      <textarea
                        value={rightsDetails}
                        onChange={(e) => setRightsDetails(e.target.value)}
                        rows={4}
                        placeholder="Please describe which records you wish to review, correct, or erase..."
                        className="legal-input"
                        style={{
                          width: '100%',
                          padding: '11px 14px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          color: '#0f172a',
                          fontSize: '14px',
                          boxSizing: 'border-box',
                          fontFamily: 'inherit'
                        }}
                      />
                    </div>

                    <div>
                      <button
                        type="submit"
                        disabled={rightsSubmitting}
                        style={{
                          padding: '12px 24px',
                          backgroundColor: '#2563eb',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(37,99,235,0.25)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {rightsSubmitting ? 'Registering Request...' : 'Submit Formal Data Rights Request'}
                      </button>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: '8px 0 0' }}>
                        Requests are processed by the Grievance Redressal Officer in accordance with statutory DPDP rules.
                      </p>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* TAB 7: ACCOUNT DELETION */}
            {activeTab === 'delete-account' && (
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', marginBottom: '12px' }}>
                  <Trash2 size={14} color="#e11d48" /> Google Play &amp; DPDP Policy Compliance
                </div>
                <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', marginBottom: '6px', letterSpacing: '-0.02em' }}>
                  Request Account Deletion &amp; Data Purge
                </h1>
                <p style={{ color: '#64748b', fontSize: '13.5px', marginBottom: '24px' }}>
                  In compliance with Google Play Store User Data policies and the DPDP Act 2023, you can request the permanent erasure of your account and personal records.
                </p>

                <div style={{ backgroundColor: '#fff1f2', border: '1px solid #fecdd3', padding: '18px 22px', borderRadius: '12px', marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '14.5px', fontWeight: '700', color: '#9f1239', margin: '0 0 8px 0' }}>
                    What happens when your account is deleted?
                  </h3>
                  <ul style={{ paddingLeft: '20px', margin: 0, color: '#881337', fontSize: '13px', lineHeight: '1.7' }}>
                    <li>Your user profile, login credentials, and session tokens are permanently erased.</li>
                    <li>Your KYC documents, uploaded PAN, and Aadhaar files are permanently purged.</li>
                    <li>Open orders will be cancelled. Regulatory trade ledger logs are retained only as required by applicable financial record-keeping laws (PMLA).</li>
                  </ul>
                </div>

                {deleteSubmitted ? (
                  <div style={{
                    padding: '32px 24px',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '12px',
                    textAlign: 'center'
                  }}>
                    <CheckCircle2 size={44} color="#16a34a" style={{ margin: '0 auto 12px' }} />
                    <h3 style={{ color: '#166534', margin: '0 0 8px 0', fontSize: '18px', fontWeight: '700' }}>
                      Deletion Request Received
                    </h3>
                    {deleteRequestId && (
                      <div style={{ display: 'inline-block', padding: '4px 12px', backgroundColor: '#e0f2fe', border: '1px solid #bae6fd', borderRadius: '6px', color: '#0284c7', fontSize: '12.5px', fontWeight: '700', fontFamily: 'monospace', marginBottom: '12px' }}>
                        Reference ID: {deleteRequestId}
                      </div>
                    )}
                    <p style={{ color: '#334155', fontSize: '13.5px', maxWidth: '580px', margin: '0 auto', lineHeight: '1.6' }}>
                      Your request for <strong>{deleteEmail}</strong> has been logged and our compliance team has been notified. 
                      Our team will verify and process your deletion within 48 business hours. You will receive a confirmation email once completed.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleDeleteRequest} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#0f172a' }}>
                        Registered Account Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={deleteEmail}
                        onChange={(e) => setDeleteEmail(e.target.value)}
                        placeholder="your.email@example.com"
                        className="legal-input"
                        style={{
                          width: '100%',
                          padding: '11px 14px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          color: '#0f172a',
                          fontSize: '14px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#0f172a' }}>
                        Reason for Deletion (Optional)
                      </label>
                      <textarea
                        value={deleteReason}
                        onChange={(e) => setDeleteReason(e.target.value)}
                        rows={3}
                        placeholder="Please let us know how we could have done better..."
                        className="legal-input"
                        style={{
                          width: '100%',
                          padding: '11px 14px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          color: '#0f172a',
                          fontSize: '14px',
                          boxSizing: 'border-box',
                          fontFamily: 'inherit'
                        }}
                      />
                    </div>

                    <div>
                      <button
                        type="submit"
                        style={{
                          padding: '12px 24px',
                          backgroundColor: '#dc2626',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(220,38,38,0.25)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        Submit Account Deletion Request
                      </button>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: '8px 0 0' }}>
                        Alternatively, email us directly at <a href="mailto:skandx.in@gmail.com" style={{ color: '#2563eb', fontWeight: '600' }}>skandx.in@gmail.com</a> or call <a href="tel:+919497861379" style={{ color: '#0f172a', fontWeight: '600' }}>+91 9497861379</a> with the subject "Delete Account".
                      </p>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* TAB 8: RISK DISCLOSURE */}
            {activeTab === 'risk' && (
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', marginBottom: '12px' }}>
                  <AlertTriangle size={14} color="#d97706" /> Mandatory Market Regulatory Warning
                </div>
                <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', marginBottom: '6px', letterSpacing: '-0.02em' }}>
                  Risk Disclosure Document
                </h1>
                <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '24px' }}>
                  Mandatory Risk Warning for Derivative &amp; Equity Products
                </p>

                <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', padding: '18px 22px', borderRadius: '12px', marginBottom: '28px' }}>
                  <strong style={{ color: '#92400e', fontSize: '14.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    ⚠️ Standard Market / SEBI Risk Disclosure Notice:
                  </strong>
                  <p style={{ margin: '8px 0 0', fontSize: '13.5px', color: '#78350f', lineHeight: '1.7' }}>
                    9 out of 10 individual traders in equity Futures and Options Segment incur net losses. 
                    On average, loss makers registered net trading losses close to ₹50,000. 
                    Over and above net trading losses incurred, loss makers expended an additional 28% of net trading losses as transaction costs.
                  </p>
                </div>

                <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', marginTop: '28px', marginBottom: '10px' }}>
                  1. Leverage Risk
                </h2>
                <p style={{ fontSize: '14.5px', lineHeight: '1.75', color: '#334155' }}>
                  Trading in leveraged contracts (Intraday &amp; F&amp;O) implies that small market movements can produce 
                  disproportionate gains or losses. In fast-moving markets, your losses can exceed your initial deposited margin.
                </p>

                <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', marginTop: '28px', marginBottom: '10px' }}>
                  2. Technical Risks
                </h2>
                <p style={{ fontSize: '14.5px', lineHeight: '1.75', color: '#334155' }}>
                  Trading through electronic communication networks involves risks of internet connectivity loss, 
                  latency, server disruptions, or delays in quote refreshes. SkandX implements automatic square-off 
                  risk guardians, but traders should maintain independent stop-loss discipline.
                </p>

                <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', marginTop: '28px', marginBottom: '10px' }}>
                  3. Regulatory Safeguards &amp; Realistic Order Execution Model
                </h2>
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <strong style={{ color: '#0f172a', fontSize: '14px' }}>Explicit Non-Advisory Protection:</strong>
                    <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: '#475569', fontStyle: 'italic', lineHeight: '1.6' }}>
                      "SkandX is strictly an educational market simulation and financial calculation platform. We are not a SEBI-registered investment advisor, research analyst, or stockbroker."
                    </p>
                  </div>
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                    <strong style={{ color: '#0f172a', fontSize: '14px' }}>No Fund Handling / Zero Escrow:</strong>
                    <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: '#475569', fontStyle: 'italic', lineHeight: '1.6' }}>
                      "Paper trading simulator uses virtual currency... All trading capital, margins, and P&amp;L are 100% virtual and hold no monetary value."
                    </p>
                  </div>
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                    <strong style={{ color: '#0f172a', fontSize: '14px' }}>Realistic Order Matching &amp; Institutional Volume Depth:</strong>
                    <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: '#475569', fontStyle: 'italic', lineHeight: '1.6' }}>
                      "SkandX is India's best paper trading app and web platform, featuring a proprietary real-time order matching engine with live tick pacing and realistic market volume matching. All simulated trades reflect real market liquidity depth and apply automated pre-trade risk checks, kill switches, and margin discipline with zero financial risk."
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 9: ACCESSIBILITY STATEMENT */}
            {activeTab === 'accessibility' && (
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', marginBottom: '12px' }}>
                  <CheckCircle2 size={14} /> Universal Usability Standard
                </div>
                <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', marginBottom: '6px', letterSpacing: '-0.02em' }}>
                  Accessibility Statement &amp; Digital Inclusion Policy
                </h1>
                <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '24px' }}>
                  Commitment to Universal Web &amp; Terminal Usability (WCAG 2.1 Level AA)
                </p>

                <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', padding: '18px 22px', borderRadius: '12px', marginBottom: '28px' }}>
                  <strong style={{ color: '#1e40af', fontSize: '14.5px' }}>♿ Our Inclusive Trading Commitment:</strong>
                  <p style={{ margin: '6px 0 0', fontSize: '14px', color: '#1e3a8a', lineHeight: '1.7' }}>
                    SkandX is dedicated to providing an accessible, intuitive trading simulation environment for all users, 
                    including those with visual, auditory, physical, speech, cognitive, or neurological disabilities. 
                    Our digital interfaces strive to conform to the <strong>Web Content Accessibility Guidelines (WCAG) 2.1 Level AA</strong>.
                  </p>
                </div>

                <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', marginTop: '28px', marginBottom: '10px' }}>
                  1. High Contrast &amp; Visual Comfort
                </h2>
                <p style={{ fontSize: '14.5px', lineHeight: '1.75', color: '#334155' }}>
                  The platform features a carefully calibrated high-contrast OLED dark theme with a compliant contrast ratio 
                  exceeding 4.5:1 for standard text and 3:1 for large graphical components. Critical trading elements utilize 
                  distinct, recognizable color cues complemented by text and icon badges to assist color-blind traders.
                </p>

                <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', marginTop: '28px', marginBottom: '10px' }}>
                  2. Keyboard Execution &amp; Navigation Hotkeys
                </h2>
                <p style={{ fontSize: '14.5px', lineHeight: '1.75', color: '#334155' }}>
                  Traders can navigate and operate the trading terminal without requiring a mouse. Built-in global keyboard shortcuts include:
                </p>
                <ul style={{ paddingLeft: '22px', fontSize: '14.5px', lineHeight: '1.8', color: '#334155' }}>
                  <li><strong style={{ color: '#0f172a' }}>Shift + B:</strong> Instantly launch the Quick Buy Order modal for the active watchlist ticker.</li>
                  <li><strong style={{ color: '#0f172a' }}>Shift + S:</strong> Instantly launch the Quick Sell Order modal for the active watchlist ticker.</li>
                  <li><strong style={{ color: '#0f172a' }}>Escape (ESC):</strong> Close any open modal dialog or slide-over drawer immediately.</li>
                  <li><strong style={{ color: '#0f172a' }}>Tab / Shift + Tab:</strong> Logical focus navigation across all interactive buttons and inputs.</li>
                </ul>

                <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', marginTop: '28px', marginBottom: '10px' }}>
                  3. Screen Reader Compatibility &amp; Assistive Tech
                </h2>
                <p style={{ fontSize: '14.5px', lineHeight: '1.75', color: '#334155' }}>
                  Interactive controls, modal dialogs, and form inputs are engineered with semantic HTML5 elements, descriptive 
                  <code>aria-label</code> tags, and meaningful <code>alt</code> text attributes for screen reader compatibility (NVDA, JAWS, VoiceOver, and TalkBack).
                </p>

                <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', marginTop: '28px', marginBottom: '10px' }}>
                  4. Feedback &amp; Accessibility Grievance Support
                </h2>
                <p style={{ fontSize: '14.5px', lineHeight: '1.75', color: '#334155' }}>
                  We welcome suggestions to improve our usability. If you encounter any accessibility barrier or have questions, please reach out to our team:
                </p>
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '18px 20px', borderRadius: '12px', marginTop: '12px', fontSize: '13.5px', lineHeight: '1.8' }}>
                  <div>🏢 <strong>Legal Entity:</strong> SkandX (Sole Proprietor: HARI KRISHNAN I VIJAYAN)</div>
                  <div>👤 <strong>Contact Person:</strong> HARI KRISHNAN I VIJAYAN</div>
                  <div>📧 <strong>Official Email:</strong> <a href="mailto:h4harikrishnan2015@gmail.com" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: '600' }}>h4harikrishnan2015@gmail.com</a> (cc: <a href="mailto:skandx.in@gmail.com" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: '600' }}>skandx.in@gmail.com</a>)</div>
                  <div>📞 <strong>Legal &amp; Support Phone:</strong> <a href="tel:+917306587969" style={{ color: '#0f172a', textDecoration: 'none', fontWeight: '600' }}>+91 7306587969</a> / <a href="tel:+919497861379" style={{ color: '#0f172a', textDecoration: 'none', fontWeight: '600' }}>+91 9497861379</a></div>
                  <div>🏢 <strong>Office Address:</strong> SkandX, Trivandrum, Kerala - 695001, India</div>
                </div>
              </div>
            )}

          </main>
        </div>

        {/* Muted Clean Footer */}
        <footer style={{ 
          textAlign: 'center', 
          marginTop: '48px', 
          paddingTop: '24px', 
          borderTop: '1px solid #e2e8f0', 
          color: '#64748b', 
          fontSize: '12.5px', 
          lineHeight: '1.8' 
        }}>
          <div>&copy; 2026 SkandX. All rights reserved. &nbsp;|&nbsp; <a href="https://skandx.in" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: '600' }}>https://skandx.in</a></div>
          <div>Legal Entity: SkandX (Sole Proprietor: HARI KRISHNAN I VIJAYAN) &nbsp;|&nbsp; Email: <a href="mailto:h4harikrishnan2015@gmail.com" style={{ color: '#0f172a', textDecoration: 'none' }}>h4harikrishnan2015@gmail.com</a> / <a href="mailto:skandx.in@gmail.com" style={{ color: '#0f172a', textDecoration: 'none' }}>skandx.in@gmail.com</a> &nbsp;|&nbsp; Helpline: <a href="tel:+917306587969" style={{ color: '#0f172a', textDecoration: 'none' }}>+91 7306587969</a> / <a href="tel:+919497861379" style={{ color: '#0f172a', textDecoration: 'none' }}>+91 9497861379</a> &nbsp;|&nbsp; Trivandrum, Kerala, India</div>
        </footer>

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
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            color: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
            zIndex: 999,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#0f172a';
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#ffffff';
            e.currentTarget.style.color = '#0f172a';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <ArrowUp size={18} />
        </button>
      )}
    </div>
  );
}
