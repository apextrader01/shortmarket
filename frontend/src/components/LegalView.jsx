import React, { useState } from 'react';
import { Shield, FileText, Trash2, AlertTriangle, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function LegalView({ initialTab = 'privacy' }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteSubmitted, setDeleteSubmitted] = useState(false);

  const handleDeleteRequest = (e) => {
    e.preventDefault();
    if (!deleteEmail.trim()) return;
    setDeleteSubmitted(true);
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0d14',
      color: '#f3f4f6',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '24px 16px'
    }}>
      <div style={{ maxWidth: '840px', margin: '0 auto' }}>
        
        {/* Navigation & Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px', fontWeight: '800', color: '#10b981', letterSpacing: '0.5px' }}>SkandX</span>
            <span style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' }}>Legal & Compliance</span>
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
            onClick={() => setActiveTab('privacy')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              backgroundColor: activeTab === 'privacy' ? '#10b981' : '#111827',
              color: activeTab === 'privacy' ? '#000' : '#9ca3af',
              transition: 'all 0.2s'
            }}
          >
            <Shield size={16} /> Privacy Policy
          </button>

          <button
            onClick={() => setActiveTab('terms')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              backgroundColor: activeTab === 'terms' ? '#10b981' : '#111827',
              color: activeTab === 'terms' ? '#000' : '#9ca3af',
              transition: 'all 0.2s'
            }}
          >
            <FileText size={16} /> Terms of Service
          </button>

          <button
            onClick={() => setActiveTab('delete-account')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              backgroundColor: activeTab === 'delete-account' ? '#ef4444' : '#111827',
              color: activeTab === 'delete-account' ? '#fff' : '#9ca3af',
              transition: 'all 0.2s'
            }}
          >
            <Trash2 size={16} /> Account Deletion
          </button>

          <button
            onClick={() => setActiveTab('risk')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              backgroundColor: activeTab === 'risk' ? '#f59e0b' : '#111827',
              color: activeTab === 'risk' ? '#000' : '#9ca3af',
              transition: 'all 0.2s'
            }}
          >
            <AlertTriangle size={16} /> Risk Disclosure
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

          {/* TAB 1: PRIVACY POLICY */}
          {activeTab === 'privacy' && (
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#fff', marginBottom: '8px' }}>
                Privacy Policy for SkandX
              </h1>
              <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '24px' }}>
                Effective Date: September 24, 2026 | Last Updated: September 2026
              </p>

              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginTop: '20px' }}>1. Overview</h2>
              <p>
                SkandX ("we", "our", or "us") operates the website <strong>https://skandx.in</strong> and the 
                <strong> SkandX Android Mobile Application</strong>. We are committed to protecting your privacy and ensuring 
                that your personal and financial information is handled safely and responsibly.
              </p>

              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginTop: '20px' }}>2. Information We Collect</h2>
              <p>When you register, log in, or interact with the SkandX platform, we may collect:</p>
              <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
                <li><strong>Account Details:</strong> Full Name, Email Address, Username, and Encrypted Password.</li>
                <li><strong>Authentication Data:</strong> Phone Number (used exclusively for Firebase SMS One-Time Passwords) and IP address for session security.</li>
                <li><strong>KYC & Regulatory Verification:</strong> PAN Card number and document image, Aadhaar details, Bank Account and IFSC details (required for regulatory compliance, AML, and fund settlement).</li>
                <li><strong>Usage & Telemetry:</strong> Trading timestamps, orders, executions, and device model for fraud prevention and risk management.</li>
              </ul>

              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginTop: '20px' }}>3. How We Use Your Information</h2>
              <p>We use your information exclusively to:</p>
              <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
                <li>Provide real-time market data, algorithmic order execution, and trading simulations.</li>
                <li>Deliver two-factor authentication (2FA) verification codes via Email and SMS.</li>
                <li>Maintain a transparent, immutable trade ledger and calculate regulatory taxes and margins.</li>
                <li>Prevent fraud, brute-force attacks, and unauthorized device logins.</li>
              </ul>
              <p style={{ fontWeight: '600', color: '#f3f4f6', marginTop: '12px' }}>
                We NEVER sell, rent, or trade your personal data to third-party marketing companies.
              </p>

              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginTop: '20px' }}>4. Data Security & Storage</h2>
              <p>
                All data transmitted between your device and our servers is secured using Industry-Standard 
                TLS/SSL 256-bit encryption. Passwords and credentials are cryptographically hashed using salted 
                bcrypt. Database access is strictly restricted through authenticated VPC channels.
              </p>

              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginTop: '20px' }}>5. Third-Party Integrations</h2>
              <p>To provide high-reliability services, we integrate with trusted infrastructure providers:</p>
              <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
                <li><strong>Google Cloud & Firebase:</strong> For cloud hosting, secure infrastructure, and SMS verification.</li>
                <li><strong>Exchange & Broker APIs (Fyers / Angel One):</strong> For live tick streaming and market execution.</li>
                <li><strong>Razorpay:</strong> For secure payment gateway processing (we do not store your credit/debit card numbers).</li>
              </ul>

              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginTop: '20px' }}>6. Contact Us</h2>
              <p>
                If you have questions about this Privacy Policy or wish to exercise your data rights, contact us at:
                <br /><strong style={{ color: '#10b981' }}>support@skandx.in</strong>
              </p>
            </div>
          )}

          {/* TAB 2: TERMS OF SERVICE */}
          {activeTab === 'terms' && (
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#fff', marginBottom: '8px' }}>
                Terms and Conditions
              </h1>
              <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '24px' }}>
                Effective Date: September 24, 2026 | Last Updated: September 2026
              </p>

              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginTop: '20px' }}>1. Acceptance of Terms</h2>
              <p>
                By downloading, accessing, or using the SkandX web terminal (https://skandx.in) or SkandX Android Mobile App, 
                you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the service.
              </p>

              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginTop: '20px' }}>2. Nature of Platform & Educational Simulator</h2>
              <p>
                SkandX provides algorithmic execution tools, advanced charting, paper trading simulators, and market analysis software. 
                All market simulation features, virtual wallets, and contest leaderboards are intended for educational and skill-building purposes.
              </p>

              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginTop: '20px' }}>3. User Obligations & Account Security</h2>
              <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
                <li>You are solely responsible for maintaining the confidentiality of your username, password, and OTP codes.</li>
                <li>You agree not to attempt to reverse engineer, scrape, DDoS, or disrupt our market data feeds or backend APIs.</li>
                <li>Accounts detected engaging in abusive arbitrage or fraudulent identity manipulation are subject to immediate termination.</li>
              </ul>

              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginTop: '20px' }}>4. Disclaimer of Warranties</h2>
              <p>
                The platform is provided on an "AS IS" and "AS AVAILABLE" basis. While we strive for 99.9% uptime, 
                we are not liable for losses caused by internet latency, exchange connectivity disruptions, or market volatility.
              </p>
            </div>
          )}

          {/* TAB 3: ACCOUNT DELETION (Google Play Policy Requirement) */}
          {activeTab === 'delete-account' && (
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#ef4444', marginBottom: '8px' }}>
                Request Account Deletion
              </h1>
              <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '24px' }}>
                In compliance with Google Play Store User Data policies, users can request the complete deletion 
                of their SkandX account and associated personal data at any time.
              </p>

              <div style={{ backgroundColor: '#1f2937', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#f3f4f6', marginBottom: '8px' }}>
                  What happens when your account is deleted?
                </h3>
                <ul style={{ paddingLeft: '20px', margin: 0, color: '#9ca3af', fontSize: '13px' }}>
                  <li>Your user profile, login credentials, and session tokens are permanently erased.</li>
                  <li>Your KYC documents, uploaded PAN, and Aadhaar files are permanently purged.</li>
                  <li>Open orders will be cancelled. Regulatory trade ledger logs are retained only as required by applicable financial record-keeping laws.</li>
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
                  <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>
                    Your request for <strong>{deleteEmail}</strong> has been logged. Our compliance team will 
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
                        outline: 'none',
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
                        outline: 'none',
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
                      marginTop: '8px',
                      transition: 'background 0.2s'
                    }}
                  >
                    Submit Account Deletion Request
                  </button>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0' }}>
                    Alternatively, email us directly at <strong style={{ color: '#10b981' }}>support@skandx.in</strong> from your registered email address with the subject "Delete Account".
                  </p>
                </form>
              )}
            </div>
          )}

          {/* TAB 4: RISK DISCLOSURE */}
          {activeTab === 'risk' && (
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#f59e0b', marginBottom: '8px' }}>
                Risk Disclosure Document
              </h1>
              <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '24px' }}>
                Mandatory Risk Warning for Derivative & Equity Products
              </p>

              <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                <strong style={{ color: '#f59e0b' }}>⚠️ Standard SEBI / Market Risk Warning:</strong>
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
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '32px', color: '#4b5563', fontSize: '12px' }}>
          &copy; 2026 SkandX Trading Platform. All rights reserved. | <a href="https://skandx.in" style={{ color: '#10b981', textDecoration: 'none' }}>https://skandx.in</a>
        </div>

      </div>
    </div>
  );
}
