const fs = require('fs');
const file = 'backend/server.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Update /api/referrals to calculate Available Balance
const targetReferrals = `    const totalEarned = referrals.filter(r => r.status === 'completed').reduce((sum, r) => sum + parseFloat(r.reward_amount || 0), 0);
    const pendingCount = referrals.filter(r => r.status === 'pending').length;
    const completedCount = referrals.filter(r => r.status === 'completed').length;

    res.json({`;
const replacementReferrals = `    const totalEarned = referrals.filter(r => r.status === 'completed').reduce((sum, r) => sum + parseFloat(r.reward_amount || 0), 0);
    const pendingCount = referrals.filter(r => r.status === 'pending').length;
    const completedCount = referrals.filter(r => r.status === 'completed').length;

    // Get withdrawal stats
    const withdrawals = await db('reward_withdrawals').where({ user_id: req.user.id });
    const totalWithdrawn = withdrawals.filter(w => w.status === 'CREDITED').reduce((sum, w) => sum + parseFloat(w.amount), 0);
    const pendingWithdrawalAmount = withdrawals.filter(w => w.status === 'PENDING' || w.status === 'PROCESSING').reduce((sum, w) => sum + parseFloat(w.amount), 0);
    const availableRewardBalance = totalEarned - totalWithdrawn - pendingWithdrawalAmount;

    res.json({`;
content = content.replace(targetReferrals, replacementReferrals);

// Update /api/referrals stats response
const targetStats = `      stats: {
        totalEarned,
        pendingCount,
        completedCount,
        totalCount: referrals.length
      }`;
const replacementStats = `      stats: {
        totalEarned,
        pendingCount,
        completedCount,
        totalCount: referrals.length,
        totalWithdrawn,
        pendingWithdrawalAmount,
        availableRewardBalance
      },
      withdrawals`;
content = content.replace(targetStats, replacementStats);

// 2. Add Withdrawal & Bank Details APIs
const newApis = `
// --- REWARD WITHDRAWALS & BANK DETAILS ---

app.post('/api/user/bank_details', authenticateToken, async (req, res) => {
  try {
    const { upi_id, bank_account_no, bank_ifsc } = req.body;
    await db('users').where({ id: req.user.id }).update({
      upi_id,
      bank_account_no,
      bank_ifsc
    });
    res.json({ success: true, message: 'Bank details updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/withdrawals/request', authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || isNaN(amount) || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

    // Check if user has bank details
    const user = await db('users').where({ id: req.user.id }).first();
    if (!user.upi_id && (!user.bank_account_no || !user.bank_ifsc)) {
      return res.status(400).json({ error: 'Please update your Bank or UPI details in Settings before withdrawing' });
    }

    // Calculate available balance
    const referrals = await db('referrals').where({ referrer_id: req.user.id, status: 'completed' });
    const totalEarned = referrals.reduce((sum, r) => sum + parseFloat(r.reward_amount || 0), 0);
    
    const withdrawals = await db('reward_withdrawals').where({ user_id: req.user.id });
    const blockedAmount = withdrawals.filter(w => ['PENDING', 'PROCESSING', 'CREDITED'].includes(w.status)).reduce((sum, w) => sum + parseFloat(w.amount), 0);
    
    const availableRewardBalance = totalEarned - blockedAmount;

    if (amount > availableRewardBalance) {
      return res.status(400).json({ error: 'Insufficient reward balance' });
    }

    await db('reward_withdrawals').insert({
      user_id: req.user.id,
      amount: amount,
      status: 'PENDING'
    });

    res.json({ success: true, message: 'Withdrawal request submitted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/withdrawals', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller.is_admin) return res.status(403).json({ error: 'Admin access required' });

    const withdrawals = await db('reward_withdrawals')
      .join('users', 'reward_withdrawals.user_id', 'users.id')
      .select(
        'reward_withdrawals.*', 
        'users.username', 
        'users.email',
        'users.phone',
        'users.upi_id',
        'users.bank_account_no',
        'users.bank_ifsc'
      )
      .orderBy('reward_withdrawals.created_at', 'desc');

    res.json({ success: true, withdrawals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/withdrawals/:id/process', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller.is_admin) return res.status(403).json({ error: 'Admin access required' });

    const { status } = req.body; // 'PROCESSING', 'CREDITED', 'REJECTED'
    if (!['PROCESSING', 'CREDITED', 'REJECTED'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

    await db('reward_withdrawals').where({ id: req.params.id }).update({ status, updated_at: db.fn.now() });

    res.json({ success: true, message: 'Withdrawal status updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
`;

content = content.replace("app.get('/api/referrals'", newApis + "\napp.get('/api/referrals'");

// Update auth route to return bank details
content = content.replace("kyc_aadhar_url: user.kyc_aadhar_url", "kyc_aadhar_url: user.kyc_aadhar_url, upi_id: user.upi_id, bank_account_no: user.bank_account_no, bank_ifsc: user.bank_ifsc");

fs.writeFileSync(file, content);
