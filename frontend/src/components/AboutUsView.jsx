import React, { useState } from 'react';
import { ChevronLeft, Phone, Mail, Globe, MapPin, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import { useSocialLinks } from '../utils/socialLinks';
import logoImg from '../assets/logo.png';

export default function AboutUsView({ setActiveTab }) {
  const [openPolicy, setOpenPolicy] = useState(null);
  const { links: socialLinks } = useSocialLinks();

  const togglePolicy = (index) => {
    setOpenPolicy(openPolicy === index ? null : index);
  };

  const policies = [
    {
      title: 'Explicit Risk & Educational Disclaimers',
      content: 'SkandX is strictly an educational market simulation and financial calculation platform. We are not a SEBI-registered investment advisor, research analyst, or stockbroker. No financial advice, stock tips, buy/sell calls, or guaranteed returns are provided.',
      link: '/risk-policy',
      linkLabel: 'View Risk Disclosures →'
    },
    {
      title: 'No Fund Handling / Zero Escrow',
      content: 'Paper trading simulator uses virtual currency for simulation and educational learning. All trading capital, margins, and P&L are 100% virtual and hold no monetary value. SkandX does not accept, hold, or escrow public deposits or client investment funds.',
      link: '/terms',
      linkLabel: 'View Terms of Service →'
    },
    {
      title: 'Realistic Order Matching & Institutional Volume Depth',
      content: "SkandX is India's best paper trading app and web platform, featuring a proprietary real-time order matching engine with live tick pacing and realistic market volume matching. All simulated trades reflect real market liquidity depth and apply automated pre-trade risk checks, kill switches, and margin discipline with zero financial risk.",
      link: '/terms',
      linkLabel: 'View Platform Compliance →'
    },
    {
      title: 'Membership Details',
      content: 'SkandX is a premier trading platform providing next-generation features for active traders and investors. Our membership grants you access to comprehensive market data, advanced charting, lightning-fast execution, and exclusive analytics. We are committed to providing a seamless and personalized trading experience.'
    },
    {
      title: 'Fraud Prevention',
      content: 'Security is at the core of SkandX. We employ bank-grade security protocols, end-to-end encryption, and real-time monitoring to protect your account. Two-factor authentication (2FA) is mandatory for all logins and withdrawals. Never share your OTP, password, or PIN with anyone, including SkandX representatives.'
    },
    {
      title: 'Privacy Policy',
      content: 'Your privacy is our utmost priority. We collect only the information necessary to facilitate your trades and comply with regulatory KYC/AML requirements. We have strict data governance policies in place and guarantee that your personal and financial data is never sold to third-party marketers.',
      link: '/privacy-policy',
      linkLabel: 'View Privacy Policy →'
    },
    {
      title: 'Terms and Conditions',
      content: 'By accessing and using the SkandX platform, you agree to abide by our standard terms of service. Trading in equities, derivatives, and commodities involves substantial risk of loss. You acknowledge that you are solely responsible for all trading decisions and outcomes.',
      link: '/terms',
      linkLabel: 'View Terms of Service →'
    },
    {
      title: 'Cancellation & Refund Policy',
      content: 'All new users receive an unrestricted 12-day free all-access trial. Paid digital subscriptions are non-refundable once activated as digital services are fulfilled immediately. Duplicate or accidental charges are automatically reconciled within 24–48 hours.',
      link: '/refund-policy',
      linkLabel: 'View Cancellation & Refund Policy →'
    },
    {
      title: 'Risk Policies',
      content: 'Options and margin trading are highly leveraged and carry a high degree of risk. Please review our comprehensive Risk Disclosure Document before engaging in leveraged trading.',
      link: '/risk-policy',
      linkLabel: 'View Risk Disclosure Document →'
    },
    {
      title: 'Data Principal Rights (DPDP Act, 2023)',
      content: 'Under the Digital Personal Data Protection Act, 2023, you have the right to access, export, correct, or erase your personal data at any time through our Data Rights Portal.',
      link: '/data-rights',
      linkLabel: 'Open Data Rights Portal →'
    },
    {
      title: 'Account & Data Deletion',
      content: 'You may request permanent deletion of your SkandX account and associated personal records at any time.',
      link: '/delete-account',
      linkLabel: 'Request Account Deletion →'
    },
    {
      title: 'Digital Service Delivery & Shipping Policy',
      content: 'SkandX delivers 100% cloud-based digital financial simulation, algorithmic analysis, and market educational tools. Subscriptions and virtual capital allocations are provisioned instantly upon successful payment authorization through Cashfree Payments with zero shipping delays or physical courier charges.',
      link: '/shipping-policy',
      linkLabel: 'View Shipping & Delivery Policy →'
    },
    {
      title: 'Contact Us & Corporate Identification',
      content: 'SkandX is owned and operated by Sole Proprietor HARI KRISHNAN I VIJAYAN. Registered office: SkandX, Trivandrum, Kerala - 695001, India. Official correspondence: h4harikrishnan2015@gmail.com / skandx.in@gmail.com | Phone: +91 7306587969 / +91 9497861379.',
      link: '/contact',
      linkLabel: 'View Contact & Corporate Details →'
    },
    {
      title: 'Roles and Responsibilities for UPI',
      content: 'UPI transactions are subject to limits imposed by your banking institution and the NPCI. SkandX processes UPI mandates instantly for fund addition, but settlement to your trading ledger is subject to successful confirmation from your bank. Ensure your UPI ID is linked to your registered bank account.'
    }
  ];

  const regulators = ['BSE', 'NSE', 'NCDEX', 'SEBI', 'MCX-SX', 'SCORES', 'MCX'];

  return (
    <div style={{ padding: '20px', color: 'var(--text-primary)', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '40px', cursor: 'pointer' }} onClick={() => setActiveTab('ClientData')}>
        <ChevronLeft size={20} style={{ marginRight: '8px' }} />
        <span style={{ fontSize: '16px', fontWeight: '600' }}>About Us</span>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Brand Hero */}
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', marginBottom: '40px' }}>
          <img
            src={logoImg}
            alt="SkandX Logo"
            style={{
              width: '80px', height: '80px', borderRadius: '20px',
              margin: '0 auto 20px', display: 'block',
              boxShadow: '0 0 24px rgba(56, 189, 248, 0.45)',
              border: '1px solid rgba(125, 211, 252, 0.4)',
              objectFit: 'cover'
            }}
          />
          <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>SkandX</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '40px' }}>Service Truly Personalised</p>

          <div style={{ display: 'flex', justifyContent: 'space-around', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '30px' }}>
            <div>
              <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>10+</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Years of Trust</div>
            </div>
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '40px' }}>
              <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>Next-Gen</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Trading Tech</div>
            </div>
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '40px' }}>
              <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>Pro</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Analytics</div>
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <Phone size={20} color="var(--text-secondary)" style={{ marginRight: '16px', marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Legal Entity / Proprietor &amp; Phone</div>
              <div style={{ fontSize: '14px', fontWeight: '600' }}>
                HARI KRISHNAN I VIJAYAN (Operating as SkandX)<br />
                <a href="tel:+917306587969" style={{ color: 'var(--color-blue-light)', textDecoration: 'none' }}>+91 7306587969</a>
                <span style={{ color: 'var(--text-secondary)', margin: '0 6px' }}>•</span>
                <a href="tel:+919497861379" style={{ color: 'var(--color-blue-light)', textDecoration: 'none' }}>+91 9497861379</a>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <Mail size={20} color="var(--text-secondary)" style={{ marginRight: '16px', marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Official &amp; Support Email</div>
              <div style={{ fontSize: '14px', fontWeight: '600' }}>
                <a href="mailto:h4harikrishnan2015@gmail.com" style={{ color: 'var(--color-blue-light)', textDecoration: 'none' }}>h4harikrishnan2015@gmail.com</a>
                <span style={{ color: 'var(--text-secondary)', margin: '0 6px' }}>•</span>
                <a href="mailto:skandx.in@gmail.com" style={{ color: 'var(--color-blue-light)', textDecoration: 'none' }}>skandx.in@gmail.com</a>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <Globe size={20} color="var(--text-secondary)" style={{ marginRight: '16px', marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Website</div>
              <div style={{ fontSize: '14px', fontWeight: '600' }}>
                <a href="https://skandx.in" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-blue-light)', textDecoration: 'none' }}>https://skandx.in</a>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', padding: '20px' }}>
            <MapPin size={20} color="var(--text-secondary)" style={{ marginRight: '16px', marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Registered Office Address</div>
              <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
                SkandX (Sole Proprietor: HARI KRISHNAN I VIJAYAN), Trivandrum, Kerala - 695001, India
              </div>
            </div>
          </div>
        </div>

        {/* Official Social Channels & Direct Support */}
        <div className="glass-panel" style={{ padding: '22px', marginBottom: '36px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '6px', color: 'var(--text-primary)' }}>
            Official Channels &amp; Direct Support
          </h3>
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '16px', marginTop: 0 }}>
            Follow our official channels for daily market analysis, option setups, and instant 1-on-1 trader support:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
            <a
              href={socialLinks.instagram}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(225, 48, 108, 0.16), rgba(131, 58, 180, 0.16))',
                border: '1px solid rgba(225, 48, 108, 0.4)',
                color: '#f472b6',
                textDecoration: 'none',
                fontWeight: '700',
                fontSize: '13px'
              }}
            >
              <span style={{ fontSize: '18px' }}>📸</span>
              <div>
                <div style={{ color: '#fff', fontSize: '13px', fontWeight: '800' }}>Instagram</div>
                <div style={{ fontSize: '11px', color: '#f472b6' }}>Follow Channel →</div>
              </div>
            </a>

            <a
              href={socialLinks.facebook}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'rgba(24, 119, 242, 0.14)',
                border: '1px solid rgba(24, 119, 242, 0.4)',
                color: '#60a5fa',
                textDecoration: 'none',
                fontWeight: '700',
                fontSize: '13px'
              }}
            >
              <span style={{ fontSize: '18px' }}>📘</span>
              <div>
                <div style={{ color: '#fff', fontSize: '13px', fontWeight: '800' }}>Facebook Page</div>
                <div style={{ fontSize: '11px', color: '#60a5fa' }}>Visit Official Page →</div>
              </div>
            </a>

            <a
              href={socialLinks.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'rgba(37, 211, 102, 0.14)',
                border: '1px solid rgba(37, 211, 102, 0.4)',
                color: '#4ade80',
                textDecoration: 'none',
                fontWeight: '700',
                fontSize: '13px'
              }}
            >
              <span style={{ fontSize: '18px' }}>💬</span>
              <div>
                <div style={{ color: '#fff', fontSize: '13px', fontWeight: '800' }}>WhatsApp Desk</div>
                <div style={{ fontSize: '11px', color: '#4ade80' }}>{socialLinks.whatsappNumber || '+91 9497861379'} →</div>
              </div>
            </a>

            <a
              href={socialLinks.telegram}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'rgba(0, 136, 204, 0.16)',
                border: '1px solid rgba(0, 136, 204, 0.4)',
                color: '#38bdf8',
                textDecoration: 'none',
                fontWeight: '700',
                fontSize: '13px'
              }}
            >
              <span style={{ fontSize: '18px' }}>✈️</span>
              <div>
                <div style={{ color: '#fff', fontSize: '13px', fontWeight: '800' }}>Telegram</div>
                <div style={{ fontSize: '11px', color: '#38bdf8' }}>Join Channel →</div>
              </div>
            </a>
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
                      <a href={policy.link} style={{ color: 'var(--color-blue-light)', textDecoration: 'none', fontWeight: '600' }}>
                        {policy.linkLabel || 'Read more →'}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Website Copy & Regulatory Safeguards */}
        <div className="glass-panel" style={{ padding: '24px', marginBottom: '40px', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <ShieldCheck size={20} color="#38bdf8" />
            <h3 style={{ fontSize: '17px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
              Website Copy &amp; Regulatory Safeguards
            </h3>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '18px', lineHeight: '1.6' }}>
            SkandX operates with built-in regulatory protections that strictly satisfy payment gateway and financial compliance reviewers:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ background: 'var(--bg-hover)', padding: '14px 16px', borderRadius: '8px', borderLeft: '3px solid #38bdf8' }}>
              <div style={{ fontWeight: '700', fontSize: '13.5px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                1. Explicit Risk &amp; Educational Disclaimers:
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', fontStyle: 'italic' }}>
                "SkandX is strictly an educational market simulation and financial calculation platform. We are not a SEBI-registered investment advisor, research analyst, or stockbroker..."
              </div>
            </div>

            <div style={{ background: 'var(--bg-hover)', padding: '14px 16px', borderRadius: '8px', borderLeft: '3px solid #10b981' }}>
              <div style={{ fontWeight: '700', fontSize: '13.5px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                2. No Fund Handling / Zero Escrow:
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', fontStyle: 'italic' }}>
                "Paper trading simulator uses virtual currency... All trading capital, margins, and P&amp;L are 100% virtual and hold no monetary value."
              </div>
            </div>

            <div style={{ background: 'var(--bg-hover)', padding: '14px 16px', borderRadius: '8px', borderLeft: '3px solid #f59e0b' }}>
              <div style={{ fontWeight: '700', fontSize: '13.5px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                3. Realistic Order Matching &amp; Institutional Volume Depth:
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', fontStyle: 'italic' }}>
                "SkandX is India's best paper trading app and web platform, featuring a proprietary real-time order matching engine with live tick pacing and realistic market volume matching. All simulated trades reflect real market liquidity depth and apply automated pre-trade risk checks, kill switches, and margin discipline with zero financial risk."
              </div>
            </div>
          </div>
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

        {/* Legal & Policy Compliance Footer */}
        <div style={{
          textAlign: 'center',
          padding: '24px 16px 36px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          lineHeight: '1.9'
        }}>
          <div style={{ marginBottom: '8px', fontWeight: '600', color: 'var(--text-primary)' }}>
            SkandX • Legal Entity: Sole Proprietor HARI KRISHNAN I VIJAYAN | Trivandrum, Kerala - 695001, India
          </div>
          <div style={{ marginBottom: '12px' }}>
            Official Email: <a href="mailto:h4harikrishnan2015@gmail.com" style={{ color: 'var(--color-blue-light)', textDecoration: 'none' }}>h4harikrishnan2015@gmail.com</a>
            <span style={{ margin: '0 8px' }}>•</span>
            Support: <a href="mailto:skandx.in@gmail.com" style={{ color: 'var(--color-blue-light)', textDecoration: 'none' }}>skandx.in@gmail.com</a>
            <span style={{ margin: '0 8px' }}>•</span>
            Helpline: <a href="tel:+917306587969" style={{ color: 'var(--color-blue-light)', textDecoration: 'none' }}>+91 7306587969</a> / <a href="tel:+919497861379" style={{ color: 'var(--color-blue-light)', textDecoration: 'none' }}>+91 9497861379</a>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
            <a href="/aboutus" style={{ color: 'var(--color-blue-light)', textDecoration: 'none' }}>About Us</a>
            <span>•</span>
            <a href="/contact" style={{ color: 'var(--color-blue-light)', textDecoration: 'none' }}>Contact Us</a>
            <span>•</span>
            <a href="/pricing" style={{ color: 'var(--color-blue-light)', textDecoration: 'none' }}>Pricing</a>
            <span>•</span>
            <a href="/terms" style={{ color: 'var(--color-blue-light)', textDecoration: 'none' }}>Terms &amp; Conditions</a>
            <span>•</span>
            <a href="/privacy-policy" style={{ color: 'var(--color-blue-light)', textDecoration: 'none' }}>Privacy Policy</a>
            <span>•</span>
            <a href="/refund-policy" style={{ color: 'var(--color-blue-light)', textDecoration: 'none' }}>Cancellation &amp; Refund Policy</a>
            <span>•</span>
            <a href="/shipping-policy" style={{ color: 'var(--color-blue-light)', textDecoration: 'none' }}>Shipping &amp; Delivery Policy</a>
            <span>•</span>
            <a href="/risk-policy" style={{ color: 'var(--color-blue-light)', textDecoration: 'none' }}>Risk Disclosure</a>
          </div>
        </div>
      </div>
    </div>
  );
}


