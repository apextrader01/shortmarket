const fs = require('fs');
const file = 'frontend/src/components/SettingsView.jsx';
let content = fs.readFileSync(file, 'utf8');

const target1 = `const { user, updatePassword, logout, oneClickMode, setOneClickMode, oneClickMultiplier, setOneClickMultiplier } = useStore(useShallow(state => ({ user: state.user, updatePassword: state.updatePassword, logout: state.logout, oneClickMode: state.oneClickMode, setOneClickMode: state.setOneClickMode, oneClickMultiplier: state.oneClickMultiplier, setOneClickMultiplier: state.setOneClickMultiplier })));`;
const replace1 = `const { user, updatePassword, logout, oneClickMode, setOneClickMode, oneClickMultiplier, setOneClickMultiplier, updateBankDetails } = useStore(useShallow(state => ({ user: state.user, updatePassword: state.updatePassword, logout: state.logout, oneClickMode: state.oneClickMode, setOneClickMode: state.setOneClickMode, oneClickMultiplier: state.oneClickMultiplier, setOneClickMultiplier: state.setOneClickMultiplier, updateBankDetails: state.updateBankDetails })));

  const [bankDetails, setBankDetails] = useState({
    upi_id: user?.upi_id || '',
    bank_account_no: user?.bank_account_no || '',
    bank_ifsc: user?.bank_ifsc || ''
  });
  const [bankLoading, setBankLoading] = useState(false);
  const [bankMsg, setBankMsg] = useState({ type: '', text: '' });

  const handleBankSubmit = async (e) => {
    e.preventDefault();
    setBankLoading(true);
    setBankMsg({ type: '', text: '' });
    try {
      await updateBankDetails(bankDetails);
      setBankMsg({ type: 'success', text: 'Bank details updated successfully!' });
    } catch(err) {
      setBankMsg({ type: 'error', text: err.message });
    }
    setBankLoading(false);
  };
`;
content = content.replace(target1, replace1);

const target2 = `      <div className="card" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '24px' }}>Change Password</h2>`;
const replace2 = `      <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '24px' }}>Bank & UPI Details (For Withdrawals)</h2>
        {bankMsg.text && (
          <div style={{ padding: '12px', borderRadius: '6px', marginBottom: '16px', background: bankMsg.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: bankMsg.type === 'success' ? 'var(--color-green-light)' : 'var(--color-red-light)', fontSize: '14px' }}>
            {bankMsg.text}
          </div>
        )}
        <form onSubmit={handleBankSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>UPI ID</label>
              <input type="text" className="input" value={bankDetails.upi_id} onChange={e => setBankDetails({...bankDetails, upi_id: e.target.value})} placeholder="username@upi" style={{ width: '100%', maxWidth: '400px' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>Bank Account Number</label>
              <input type="text" className="input" value={bankDetails.bank_account_no} onChange={e => setBankDetails({...bankDetails, bank_account_no: e.target.value})} placeholder="Account Number" style={{ width: '100%', maxWidth: '400px' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>Bank IFSC Code</label>
              <input type="text" className="input" value={bankDetails.bank_ifsc} onChange={e => setBankDetails({...bankDetails, bank_ifsc: e.target.value})} placeholder="IFSC Code" style={{ width: '100%', maxWidth: '400px' }} />
            </div>
            <div>
              <button type="submit" className="btn btn-primary" disabled={bankLoading}>
                {bankLoading ? 'Saving...' : 'Save Bank Details'}
              </button>
            </div>
          </div>
        </form>
      </div>
      <div className="card" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '24px' }}>Change Password</h2>`;
content = content.replace(target2, replace2);

fs.writeFileSync(file, content);
