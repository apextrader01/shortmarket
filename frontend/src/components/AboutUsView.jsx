import React, { useState } from 'react';
import { ChevronLeft, Phone, Mail, Globe, MapPin, ChevronDown, ChevronUp } from 'lucide-react';

export default function AboutUsView({ setActiveTab }) {
  const [openPolicy, setOpenPolicy] = useState(null);

  const togglePolicy = (index) => {
    setOpenPolicy(openPolicy === index ? null : index);
  };

  const policies = [
    {
      title: 'Membership Details',
      content: 'Short Edge is a premier trading platform providing next-generation features for active traders and investors. Our membership grants you access to comprehensive market data, advanced charting, lightning-fast execution, and exclusive analytics. We are committed to providing a seamless and personalized trading experience.'
    },
    {
      title: 'Fraud Prevention',
      content: 'Security is at the core of Short Edge. We employ bank-grade security protocols, end-to-end encryption, and real-time monitoring to protect your account. Two-factor authentication (2FA) is mandatory for all logins and withdrawals. Never share your OTP, password, or PIN with anyone, including Short Edge representatives.'
    },
    {
      title: 'Privacy Policy',
      content: 'Your privacy is our utmost priority. We collect only the information necessary to facilitate your trades and comply with regulatory KYC/AML requirements. We have strict data governance policies in place and guarantee that your personal and financial data is never sold to third-party marketers.'
    },
    {
      title: 'Terms and Conditions',
      content: 'By accessing and using the Short Edge platform, you agree to abide by our standard terms of service. Trading in equities, derivatives, and commodities involves substantial risk of loss. You acknowledge that you are solely responsible for all trading decisions and outcomes.'
    },
    {
      title: 'Risk Policies',
      content: 'Options and margin trading are highly leveraged and carry a high degree of risk. Please review our comprehensive Risk Disclosure Document before engaging in leveraged trading.',
      link: 'https://www.shortedge.in/riskpolicy'
    },
    {
      title: 'Roles and Responsibilities for UPI',
      content: 'UPI transactions are subject to limits imposed by your banking institution and the NPCI. Short Edge processes UPI mandates instantly for fund addition, but settlement to your trading ledger is subject to successful confirmation from your bank. Ensure your UPI ID is linked to your registered bank account.'
    }
  ];

  const regulators = ['BSE', 'NSE', 'NCDEX', 'SEBI', 'MCX-SX', 'SCORES', 'MCX'];

  return (
    <div style={{ padding: '20px', color: '#E2E8F0', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '40px', cursor: 'pointer' }} onClick={() => setActiveTab('ClientData')}>
        <ChevronLeft size={20} style={{ marginRight: '8px' }} />
        <span style={{ fontSize: '16px', fontWeight: '600' }}>About Us</span>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Brand Hero */}
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ 
            width: '80px', height: '80px', borderRadius: '50%', background: '#3B82F6', 
            margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '36px', fontWeight: '800', color: '#FFF'
          }}>
            S
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>Short Edge</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '40px' }}>Service Truly Personalised</p>

          <div style={{ display: 'flex', justifyContent: 'space-around', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '30px' }}>
            <div>
              <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>10+</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Years of Trust</div>
            </div>
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '40px' }}>
              <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>Next-Gen</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Stock Broking</div>
            </div>
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '40px' }}>
              <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>Pro</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Analytics</div>
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <Phone size={20} color="var(--text-secondary)" style={{ marginRight: '16px', marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Phone</div>
              <div style={{ fontSize: '14px', fontWeight: '600' }}>1800 123 4567</div>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'flex-start', padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <Mail size={20} color="var(--text-secondary)" style={{ marginRight: '16px', marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Email</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-blue-light)' }}>support@shortedge.in</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <Globe size={20} color="var(--text-secondary)" style={{ marginRight: '16px', marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Website</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-blue-light)' }}>https://www.shortedge.in</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', padding: '20px' }}>
            <MapPin size={20} color="var(--text-secondary)" style={{ marginRight: '16px', marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Location</div>
              <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
                Level 4, Trade Centre, Financial District,<br/>
                Mumbai, Maharashtra - 400051.<br/>
                Phone: 1800 123 4567
              </div>
            </div>
          </div>
        </div>

        {/* Policies Accordion */}
        <div className="glass-panel" style={{ padding: '20px', marginBottom: '40px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: 'var(--text-secondary)' }}>Policies</h3>
          
          {policies.map((policy, idx) => (
            <div key={idx} style={{ borderBottom: idx !== policies.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
              <div 
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', cursor: 'pointer' }}
                onClick={() => togglePolicy(idx)}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: '24px', height: '24px', marginRight: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-secondary)' }} />
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: '600' }}>{policy.title}</span>
                </div>
                {openPolicy === idx ? <ChevronUp size={18} color="var(--text-secondary)" /> : <ChevronDown size={18} color="var(--text-secondary)" />}
              </div>
              
              {openPolicy === idx && (
                <div style={{ padding: '0 0 16px 36px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                  {policy.content}
                  {policy.link && (
                    <div style={{ marginTop: '8px' }}>
                      <a href={policy.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-blue-light)', textDecoration: 'none' }}>Read more</a>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Exchange and Regulators */}
        <div className="glass-panel" style={{ padding: '24px', marginBottom: '40px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px', color: 'var(--text-secondary)' }}>Exchange and Regulators</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {regulators.map(reg => (
              <div key={reg} style={{ background: 'var(--bg-hover)', padding: '6px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', color: 'var(--color-blue-light)' }}>
                {reg}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


