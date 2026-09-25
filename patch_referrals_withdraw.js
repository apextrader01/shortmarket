const fs = require('fs');
const file = 'frontend/src/components/ReferralsView.jsx';
let content = fs.readFileSync(file, 'utf8');

const target1 = `const { user } = useStore(useShallow(state => ({ user: state.user })));`;
const replace1 = `const { user, requestWithdrawal } = useStore(useShallow(state => ({ user: state.user, requestWithdrawal: state.requestWithdrawal })));
  
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawMsg, setWithdrawMsg] = useState({ type: '', text: '' });
  
  const handleWithdraw = async (e) => {
    e.preventDefault();
    setWithdrawLoading(true);
    setWithdrawMsg({ type: '', text: '' });
    try {
      if (!user?.upi_id && (!user?.bank_account_no || !user?.bank_ifsc)) {
         throw new Error('Please go to Settings to add your UPI or Bank Account details first.');
      }
      await requestWithdrawal(withdrawAmount);
      setWithdrawMsg({ type: 'success', text: 'Withdrawal requested successfully!' });
      setWithdrawAmount('');
      fetchReferrals(); // refresh balances
    } catch(err) {
      setWithdrawMsg({ type: 'error', text: err.message });
    }
    setWithdrawLoading(false);
  };
`;
content = content.replace(target1, replace1);

const target2 = `stats: { totalEarned: 0, pendingCount: 0, completedCount: 0, totalCount: 0 }`;
const replace2 = `stats: { totalEarned: 0, pendingCount: 0, completedCount: 0, totalCount: 0, totalWithdrawn: 0, pendingWithdrawalAmount: 0, availableRewardBalance: 0 }`;
content = content.replace(target2, replace2);

const target3 = `            <div style={{ color: 'var(--color-green-light)', fontSize: '24px', fontWeight: 'bold' }}>
              ?{data.stats.totalEarned.toFixed(2)}
            </div>
          </div>
        </div>`;
const replace3 = `            <div style={{ color: 'var(--color-green-light)', fontSize: '24px', fontWeight: 'bold' }}>
              ?{data.stats.totalEarned.toFixed(2)}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>
              Available to Withdraw: ?{data.stats.availableRewardBalance?.toFixed(2) || '0.00'}
            </div>
          </div>
        </div>
        
        {/* WITHDRAWAL SECTION */}
        <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={18} />
            Withdraw Rewards
          </h2>
          {withdrawMsg.text && (
            <div style={{ padding: '12px', borderRadius: '6px', marginBottom: '16px', background: withdrawMsg.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: withdrawMsg.type === 'success' ? 'var(--color-green-light)' : 'var(--color-red-light)', fontSize: '14px' }}>
              {withdrawMsg.text}
            </div>
          )}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <input 
              type="number" 
              className="input" 
              placeholder="Amount to withdraw" 
              value={withdrawAmount} 
              onChange={e => setWithdrawAmount(e.target.value)}
              style={{ maxWidth: '200px' }}
            />
            <button 
              className="btn btn-primary" 
              onClick={handleWithdraw} 
              disabled={withdrawLoading || !withdrawAmount || withdrawAmount <= 0}
            >
              {withdrawLoading ? 'Requesting...' : 'Request Withdrawal'}
            </button>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '12px' }}>
            Note: Update your Bank/UPI details in Settings before withdrawing.
          </div>
        </div>
`;
content = content.replace(target3, replace3);
fs.writeFileSync(file, content);
