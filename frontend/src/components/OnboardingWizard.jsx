import React, { useState } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { User, Briefcase, TrendingUp, CheckCircle, ChevronRight, ChevronLeft, Upload } from 'lucide-react';

export default function OnboardingWizard() {
  const { saveProfile } = useStore(useShallow(state => ({ saveProfile: state.saveProfile })));
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    dob: '',
    gender: '',
    state: '',
    city: '',
    occupation: '',
    annual_income: '',
    financial_goal: '',
    trading_experience: '',
    preferred_segment: '',
    trading_style: '',
    primary_strategy: '',
    hear_about_us: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.dob || !formData.gender || !formData.state || !formData.city) {
        return setError('Please fill all fields to continue.');
      }
    } else if (step === 2) {
      if (!formData.occupation || !formData.annual_income || !formData.financial_goal) {
        return setError('Please fill all fields to continue.');
      }
    }
    setError('');
    setStep(s => s + 1);
  };

  const handlePrev = () => {
    setError('');
    setStep(s => Math.max(1, s - 1));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.trading_experience || !formData.preferred_segment || !formData.trading_style || !formData.primary_strategy || !formData.hear_about_us) {
      return setError('Please complete all selections.');
    }
    
    setLoading(true);
    setError('');
    const res = await saveProfile(formData);
    if (!res.success) {
      setError(res.error || 'Failed to save profile. Please try again.');
      setLoading(false);
    }
    // On success, the store will update and App.jsx will automatically unmount this component.
  };

  const steps = [
    { id: 1, title: 'Personal Details', icon: User },
    { id: 2, title: 'Financial Background', icon: Briefcase },
    { id: 3, title: 'Trading Profile', icon: TrendingUp }
  ];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'radial-gradient(circle at center, var(--bg-hover) 0%, var(--bg-color) 100%)'
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '600px', padding: '40px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '8px', color: 'white' }}>Complete Your Profile</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Help us customize your trading experience.</p>
        </div>

        {/* Progress Stepper */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '24px', left: '10%', right: '10%', height: '2px', background: 'var(--border-color)', zIndex: 0 }} />
          <div style={{ position: 'absolute', top: '24px', left: '10%', right: '10%', height: '2px', background: 'var(--color-blue-light)', zIndex: 0, width: `${((step - 1) / 2) * 100}%`, transition: 'width 0.3s ease' }} />
          
          {steps.map((s, i) => {
            const isActive = step >= s.id;
            const Icon = s.icon;
            return (
              <div key={s.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, gap: '12px' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isActive ? 'var(--color-blue-light)' : 'var(--bg-hover)',
                  color: isActive ? 'black' : 'var(--text-secondary)',
                  border: `2px solid ${isActive ? 'var(--color-blue-light)' : 'var(--border-color)'}`,
                  transition: 'all 0.3s ease'
                }}>
                  {step > s.id ? <CheckCircle size={24} /> : <Icon size={24} />}
                </div>
                <span style={{ fontSize: '12px', fontWeight: isActive ? '600' : '400', color: isActive ? 'white' : 'var(--text-secondary)' }}>{s.title}</span>
              </div>
            );
          })}
        </div>

        {error && (
          <div style={{ padding: '12px', background: 'rgba(225,42,31,0.1)', color: 'var(--color-red-light)', borderRadius: '8px', marginBottom: '24px', fontSize: '14px', border: '1px solid rgba(225,42,31,0.2)' }}>
            {error}
          </div>
        )}

        {/* Step 1: Personal */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.3s ease' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Date of Birth</label>
              <input type="date" name="dob" value={formData.dob} onChange={handleChange} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', colorScheme: 'dark' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Gender</label>
              <select name="gender" value={formData.gender} onChange={handleChange} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white' }}>
                <option value="" disabled>Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>State</label>
                <input type="text" name="state" value={formData.state} onChange={handleChange} placeholder="e.g. Maharashtra" style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>City</label>
                <input type="text" name="city" value={formData.city} onChange={handleChange} placeholder="e.g. Mumbai" style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white' }} />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Financial */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.3s ease' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Occupation</label>
              <select name="occupation" value={formData.occupation} onChange={handleChange} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white' }}>
                <option value="" disabled>Select Occupation</option>
                <option value="Salaried">Salaried</option>
                <option value="Business">Business / Self-Employed</option>
                <option value="Student">Student</option>
                <option value="Retired">Retired</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Annual Income</label>
              <select name="annual_income" value={formData.annual_income} onChange={handleChange} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white' }}>
                <option value="" disabled>Select Income Range</option>
                <option value="Below 1L">Below ₹1 Lakh</option>
                <option value="1L - 5L">₹1 Lakh - ₹5 Lakh</option>
                <option value="5L - 10L">₹5 Lakh - ₹10 Lakh</option>
                <option value="10L - 25L">₹10 Lakh - ₹25 Lakh</option>
                <option value="25L+">Above ₹25 Lakh</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Primary Financial Goal</label>
              <select name="financial_goal" value={formData.financial_goal} onChange={handleChange} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white' }}>
                <option value="" disabled>Select your goal</option>
                <option value="Learn to trade">Learn to trade</option>
                <option value="Secondary Income">Generate Secondary Income</option>
                <option value="Full-time Trading">Full-time Trading Career</option>
                <option value="Wealth Creation">Long-term Wealth Creation</option>
              </select>
            </div>
          </div>
        )}

        {/* Step 3: Trading Profile */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.3s ease' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Trading Experience</label>
              <select name="trading_experience" value={formData.trading_experience} onChange={handleChange} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white' }}>
                <option value="" disabled>Select Experience Level</option>
                <option value="Fresher">Fresher (New to markets)</option>
                <option value="Intermediate">Intermediate (1-3 years)</option>
                <option value="Expert">Expert / Professional (3+ years)</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Preferred Segment</label>
                <select name="preferred_segment" value={formData.preferred_segment} onChange={handleChange} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white' }}>
                  <option value="" disabled>Select Segment</option>
                  <option value="Equity">Equity / Cash</option>
                  <option value="F&O">Options & Futures (F&O)</option>
                  <option value="Commodity">Commodities (MCX)</option>
                  <option value="Forex">Currency (Forex)</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Trading Style</label>
                <select name="trading_style" value={formData.trading_style} onChange={handleChange} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white' }}>
                  <option value="" disabled>Select Style</option>
                  <option value="Scalper">Scalper (Minutes)</option>
                  <option value="Intraday">Intraday (Hours)</option>
                  <option value="Swing">Swing (Days/Weeks)</option>
                  <option value="Positional">Positional / Investor</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Primary Strategy</label>
              <select name="primary_strategy" value={formData.primary_strategy} onChange={handleChange} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white' }}>
                <option value="" disabled>Select Strategy</option>
                <option value="Price Action">Pure Price Action</option>
                <option value="Indicators">Indicator Based (RSI, MACD etc)</option>
                <option value="Option Selling">Option Selling / Theta</option>
                <option value="Algo">Algo / Quant Trading</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>How did you hear about us?</label>
              <select name="hear_about_us" value={formData.hear_about_us} onChange={handleChange} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white' }}>
                <option value="" disabled>Select Source</option>
                <option value="YouTube">YouTube</option>
                <option value="Telegram">Telegram Group</option>
                <option value="Google">Google Search</option>
                <option value="Friend">Friend / Referral</option>
              </select>
            </div>
          </div>
        )}

        {/* Footer Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px' }}>
          {step > 1 ? (
            <button onClick={handlePrev} style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '600' }}>
              <ChevronLeft size={16} /> Back
            </button>
          ) : <div />}
          
          {step < 3 ? (
            <button onClick={handleNext} style={{ padding: '12px 32px', background: 'white', color: 'black', border: 'none', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '700' }}>
              Continue <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={loading} style={{ padding: '12px 32px', background: 'var(--color-blue-light)', color: 'black', border: 'none', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '700', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Saving...' : 'Start Trading'} <CheckCircle size={16} />
            </button>
          )}
        </div>
        
      </div>
    </div>
  );
}
