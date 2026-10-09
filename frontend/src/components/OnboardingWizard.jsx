import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { User, Briefcase, TrendingUp, CheckCircle, ChevronRight, ChevronLeft, Upload } from 'lucide-react';
import indianStatesData from '../data/indianStates.json';

export default function OnboardingWizard() {
  const { saveProfile, skipOnboarding } = useStore(useShallow(state => ({ saveProfile: state.saveProfile, skipOnboarding: state.skipOnboarding })));
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');

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

  const maxBirthYear = new Date().getFullYear() - 18;
  const birthYears = useMemo(() => {
    const years = [];
    for (let y = maxBirthYear; y >= 1940; y--) {
      years.push(String(y));
    }
    return years;
  }, [maxBirthYear]);

  const birthMonths = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
  ];

  const daysInSelectedMonth = useMemo(() => {
    const y = parseInt(dobYear, 10) || 2000;
    const m = parseInt(dobMonth, 10) || 1;
    const maxDays = new Date(y, m, 0).getDate();
    const days = [];
    for (let d = 1; d <= maxDays; d++) {
      days.push(String(d).padStart(2, '0'));
    }
    return days;
  }, [dobYear, dobMonth]);

  const handleDobPartChange = (part, val) => {
    let nextDay = part === 'day' ? val : dobDay;
    const nextMonth = part === 'month' ? val : dobMonth;
    const nextYear = part === 'year' ? val : dobYear;

    if (nextDay && nextMonth) {
      const y = parseInt(nextYear, 10) || 2000;
      const m = parseInt(nextMonth, 10);
      const maxD = new Date(y, m, 0).getDate();
      if (parseInt(nextDay, 10) > maxD) {
        nextDay = String(maxD).padStart(2, '0');
      }
    }

    if (part === 'day') setDobDay(nextDay);
    if (part === 'month') {
      setDobMonth(nextMonth);
      if (nextDay !== dobDay) setDobDay(nextDay);
    }
    if (part === 'year') {
      setDobYear(nextYear);
      if (nextDay !== dobDay) setDobDay(nextDay);
    }

    const combinedDob = (nextYear && nextMonth && nextDay) ? `${nextYear}-${nextMonth}-${nextDay}` : '';
    setFormData(prev => ({ ...prev, dob: combinedDob }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: value,
      ...(name === 'state' ? { city: '' } : {}) 
    }));
  };

  const availableDistricts = useMemo(() => {
    if (!formData.state) return [];
    const stateObj = indianStatesData.states.find(s => s.state === formData.state);
    return stateObj ? stateObj.districts : [];
  }, [formData.state]);

  const handleNext = () => {
    if (step === 1) {
      if (!formData.dob || !formData.gender || !formData.state || !formData.city) {
        return setError('Please fill all fields (including Day, Month, and Year of Birth) to continue.');
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
    if (e?.preventDefault) e.preventDefault();
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
    else { skipOnboarding(); } // Force local state to bypass modal permanently on success
  };

  const steps = [
    { id: 1, title: 'Personal Details', icon: User },
    { id: 2, title: 'Financial Background', icon: Briefcase },
    { id: 3, title: 'Trading Profile', icon: TrendingUp }
  ];

  const selectStyle = {
    width: '100%',
    padding: '12px 14px',
    background: '#1e293b',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '10px',
    color: '#ffffff',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '12px',
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: '6px'
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px 12px',
      background: 'radial-gradient(circle at center, #1e293b 0%, #0b0f19 100%)'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '540px',
        padding: '28px 20px',
        borderRadius: '16px',
        background: '#0f172a',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)'
      }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '6px', color: '#ffffff' }}>Complete Your Profile</h1>
          <p style={{ color: '#94a3b8', fontSize: '13px' }}>Help us customize your trading experience.</p>
        </div>

        {/* Progress Stepper */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '21px', left: '16%', right: '16%', height: '2px', background: 'rgba(255, 255, 255, 0.12)', zIndex: 0 }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg, #38bdf8, #0284c7)', width: `${((step - 1) / 2) * 100}%`, transition: 'width 0.3s ease' }} />
          </div>
          
          {steps.map((s) => {
            const isActive = step >= s.id;
            const isCurrent = step === s.id;
            const isCompleted = step > s.id;
            const Icon = s.icon;
            return (
              <div key={s.id} style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                zIndex: 1,
                textAlign: 'center',
                padding: '0 4px'
              }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isCurrent ? '#38bdf8' : (isCompleted ? '#0284c7' : '#1e293b'),
                  color: isCurrent ? '#0f172a' : (isCompleted ? '#ffffff' : '#64748b'),
                  border: `2px solid ${isCurrent ? '#38bdf8' : (isCompleted ? '#0284c7' : 'rgba(255, 255, 255, 0.15)')}`,
                  boxShadow: isCurrent ? '0 0 16px rgba(56, 189, 248, 0.4)' : 'none',
                  transition: 'all 0.3s ease',
                  marginBottom: '8px'
                }}>
                  {isCompleted ? <CheckCircle size={20} /> : <Icon size={20} />}
                </div>
                <span style={{
                  fontSize: '11.5px',
                  fontWeight: isCurrent ? '700' : '500',
                  color: isCurrent ? '#ffffff' : (isCompleted ? '#e2e8f0' : '#64748b'),
                  lineHeight: '1.25',
                  display: 'block',
                  textAlign: 'center',
                  maxWidth: '96px'
                }}>
                  {s.title}
                </span>
              </div>
            );
          })}
        </div>

        {error && (
          <div style={{ padding: '12px 14px', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', borderRadius: '10px', marginBottom: '20px', fontSize: '13px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
            {error}
          </div>
        )}

        <form onSubmit={step === 3 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}>
        {/* Step 1: Personal Details */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', animation: 'fadeIn 0.3s ease' }}>
            <div>
              <label style={labelStyle}>Date of Birth (18+ Years)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={dobDay}
                  onChange={(e) => handleDobPartChange('day', e.target.value)}
                  style={{ ...selectStyle, flex: 1, color: dobDay ? '#ffffff' : '#94a3b8' }}
                >
                  <option value="" disabled>Day</option>
                  {daysInSelectedMonth.map(d => (
                    <option key={d} value={d} style={{ color: '#ffffff', background: '#0f172a' }}>{parseInt(d, 10)}</option>
                  ))}
                </select>
                <select
                  value={dobMonth}
                  onChange={(e) => handleDobPartChange('month', e.target.value)}
                  style={{ ...selectStyle, flex: 1.4, color: dobMonth ? '#ffffff' : '#94a3b8' }}
                >
                  <option value="" disabled>Month</option>
                  {birthMonths.map(m => (
                    <option key={m.value} value={m.value} style={{ color: '#ffffff', background: '#0f172a' }}>{m.label}</option>
                  ))}
                </select>
                <select
                  value={dobYear}
                  onChange={(e) => handleDobPartChange('year', e.target.value)}
                  style={{ ...selectStyle, flex: 1.2, color: dobYear ? '#ffffff' : '#94a3b8' }}
                >
                  <option value="" disabled>Year</option>
                  {birthYears.map(y => (
                    <option key={y} value={y} style={{ color: '#ffffff', background: '#0f172a' }}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Gender</label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                style={{ ...selectStyle, color: formData.gender ? '#ffffff' : '#94a3b8' }}
              >
                <option value="" disabled>Select Gender</option>
                <option value="Male" style={{ color: '#ffffff', background: '#0f172a' }}>Male</option>
                <option value="Female" style={{ color: '#ffffff', background: '#0f172a' }}>Female</option>
                <option value="Other" style={{ color: '#ffffff', background: '#0f172a' }}>Other</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={labelStyle}>State</label>
                <select
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  style={{ ...selectStyle, color: formData.state ? '#ffffff' : '#94a3b8' }}
                >
                  <option value="" disabled>Select</option>
                  {indianStatesData.states.map(s => (
                    <option key={s.state} value={s.state} style={{ color: '#ffffff', background: '#0f172a' }}>{s.state.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>District</label>
                <select
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  disabled={!formData.state}
                  style={{
                    ...selectStyle,
                    color: formData.city ? '#ffffff' : '#94a3b8',
                    opacity: !formData.state ? 0.5 : 1
                  }}
                >
                  <option value="" disabled>Select</option>
                  {availableDistricts.map(d => (
                    <option key={d} value={d} style={{ color: '#ffffff', background: '#0f172a' }}>{d.toUpperCase()}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Financial Background */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', animation: 'fadeIn 0.3s ease' }}>
            <div>
              <label style={labelStyle}>Occupation</label>
              <select
                name="occupation"
                value={formData.occupation}
                onChange={handleChange}
                style={{ ...selectStyle, color: formData.occupation ? '#ffffff' : '#94a3b8' }}
              >
                <option value="" disabled>Select Occupation</option>
                <option value="Salaried" style={{ color: '#ffffff', background: '#0f172a' }}>Salaried</option>
                <option value="Business" style={{ color: '#ffffff', background: '#0f172a' }}>Business / Self-Employed</option>
                <option value="Student" style={{ color: '#ffffff', background: '#0f172a' }}>Student</option>
                <option value="Retired" style={{ color: '#ffffff', background: '#0f172a' }}>Retired</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Annual Income</label>
              <select
                name="annual_income"
                value={formData.annual_income}
                onChange={handleChange}
                style={{ ...selectStyle, color: formData.annual_income ? '#ffffff' : '#94a3b8' }}
              >
                <option value="" disabled>Select Income Range</option>
                <option value="Below 1L" style={{ color: '#ffffff', background: '#0f172a' }}>Below ₹1 Lakh</option>
                <option value="1L - 5L" style={{ color: '#ffffff', background: '#0f172a' }}>₹1 Lakh - ₹5 Lakh</option>
                <option value="5L - 10L" style={{ color: '#ffffff', background: '#0f172a' }}>₹5 Lakh - ₹10 Lakh</option>
                <option value="10L - 25L" style={{ color: '#ffffff', background: '#0f172a' }}>₹10 Lakh - ₹25 Lakh</option>
                <option value="25L+" style={{ color: '#ffffff', background: '#0f172a' }}>Above ₹25 Lakh</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Primary Financial Goal</label>
              <select
                name="financial_goal"
                value={formData.financial_goal}
                onChange={handleChange}
                style={{ ...selectStyle, color: formData.financial_goal ? '#ffffff' : '#94a3b8' }}
              >
                <option value="" disabled>Select your goal</option>
                <option value="Learn to trade" style={{ color: '#ffffff', background: '#0f172a' }}>Learn to trade</option>
                <option value="Secondary Income" style={{ color: '#ffffff', background: '#0f172a' }}>Generate Secondary Income</option>
                <option value="Full-time Trading" style={{ color: '#ffffff', background: '#0f172a' }}>Full-time Trading Career</option>
                <option value="Wealth Creation" style={{ color: '#ffffff', background: '#0f172a' }}>Long-term Wealth Creation</option>
              </select>
            </div>
          </div>
        )}

        {/* Step 3: Trading Profile */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', animation: 'fadeIn 0.3s ease' }}>
            <div>
              <label style={labelStyle}>Trading Experience</label>
              <select
                name="trading_experience"
                value={formData.trading_experience}
                onChange={handleChange}
                style={{ ...selectStyle, color: formData.trading_experience ? '#ffffff' : '#94a3b8' }}
              >
                <option value="" disabled>Select Experience Level</option>
                <option value="Fresher" style={{ color: '#ffffff', background: '#0f172a' }}>Fresher (New to markets)</option>
                <option value="Intermediate" style={{ color: '#ffffff', background: '#0f172a' }}>Intermediate (1-3 years)</option>
                <option value="Expert" style={{ color: '#ffffff', background: '#0f172a' }}>Expert / Professional (3+ years)</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={labelStyle}>Preferred Segment</label>
                <select
                  name="preferred_segment"
                  value={formData.preferred_segment}
                  onChange={handleChange}
                  style={{ ...selectStyle, color: formData.preferred_segment ? '#ffffff' : '#94a3b8' }}
                >
                  <option value="" disabled>Select Segment</option>
                  <option value="Equity" style={{ color: '#ffffff', background: '#0f172a' }}>Equity / Cash</option>
                  <option value="F&O" style={{ color: '#ffffff', background: '#0f172a' }}>Options & Futures (F&O)</option>
                  <option value="Commodity" style={{ color: '#ffffff', background: '#0f172a' }}>Commodities (MCX)</option>
                  <option value="Forex" style={{ color: '#ffffff', background: '#0f172a' }}>Currency (Forex)</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Trading Style</label>
                <select
                  name="trading_style"
                  value={formData.trading_style}
                  onChange={handleChange}
                  style={{ ...selectStyle, color: formData.trading_style ? '#ffffff' : '#94a3b8' }}
                >
                  <option value="" disabled>Select Style</option>
                  <option value="Scalper" style={{ color: '#ffffff', background: '#0f172a' }}>Scalper (Minutes)</option>
                  <option value="Intraday" style={{ color: '#ffffff', background: '#0f172a' }}>Intraday (Hours)</option>
                  <option value="Swing" style={{ color: '#ffffff', background: '#0f172a' }}>Swing (Days/Weeks)</option>
                  <option value="Positional" style={{ color: '#ffffff', background: '#0f172a' }}>Positional / Investor</option>
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Primary Strategy</label>
              <select
                name="primary_strategy"
                value={formData.primary_strategy}
                onChange={handleChange}
                style={{ ...selectStyle, color: formData.primary_strategy ? '#ffffff' : '#94a3b8' }}
              >
                <option value="" disabled>Select Strategy</option>
                <option value="Price Action" style={{ color: '#ffffff', background: '#0f172a' }}>Pure Price Action</option>
                <option value="Indicators" style={{ color: '#ffffff', background: '#0f172a' }}>Indicator Based (RSI, MACD etc)</option>
                <option value="Option Selling" style={{ color: '#ffffff', background: '#0f172a' }}>Option Selling / Theta</option>
                <option value="Algo" style={{ color: '#ffffff', background: '#0f172a' }}>Algo / Quant Trading</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>How did you hear about us?</label>
              <select
                name="hear_about_us"
                value={formData.hear_about_us}
                onChange={handleChange}
                style={{ ...selectStyle, color: formData.hear_about_us ? '#ffffff' : '#94a3b8' }}
              >
                <option value="" disabled>Select Source</option>
                <option value="YouTube" style={{ color: '#ffffff', background: '#0f172a' }}>YouTube</option>
                <option value="Telegram" style={{ color: '#ffffff', background: '#0f172a' }}>Telegram Group</option>
                <option value="Google" style={{ color: '#ffffff', background: '#0f172a' }}>Google Search</option>
                <option value="Friend" style={{ color: '#ffffff', background: '#0f172a' }}>Friend / Referral</option>
              </select>
            </div>
          </div>
        )}

        {/* Footer Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          {step > 1 ? (
            <button
              type="button"
              onClick={handlePrev}
              style={{
                padding: '12px 20px',
                background: '#1e293b',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px'
              }}
            >
              <ChevronLeft size={16} /> Back
            </button>
          ) : (
            <div />
          )}
          
          {step < 3 ? (
            <button
              type="submit"
              style={{
                padding: '12px 28px',
                background: '#ffffff',
                color: '#0f172a',
                border: 'none',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '14px',
                boxShadow: '0 4px 12px rgba(255, 255, 255, 0.15)'
              }}
            >
              Continue <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '12px 28px',
                background: 'linear-gradient(135deg, #38bdf8, #0284c7)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '14px',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 4px 16px rgba(56, 189, 248, 0.35)'
              }}
            >
              {loading ? 'Saving...' : 'Start Trading'} <CheckCircle size={16} />
            </button>
          )}
        </div>
        </form>
        
      </div>
    </div>
  );
}


