const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

const route = `
app.get('/api/referrals', authenticateToken, async (req, res) => {
  try {
    const referrals = await db('referrals')
      .join('users', 'referrals.referred_user_id', 'users.id')
      .where('referrals.referrer_id', req.user.id)
      .select('referrals.*', 'users.username', 'users.email')
      .orderBy('referrals.created_at', 'desc');

    const totalEarned = referrals.filter(r => r.status === 'completed').reduce((sum, r) => sum + parseFloat(r.reward_amount || 0), 0);
    const pendingCount = referrals.filter(r => r.status === 'pending').length;
    const completedCount = referrals.filter(r => r.status === 'completed').length;

    res.json({
      success: true,
      referrals,
      stats: {
        totalEarned,
        pendingCount,
        completedCount,
        totalCount: referrals.length
      }
    });
  } catch (error) {
    console.error('Error fetching referrals:', error);
    res.status(500).json({ error: 'Failed to fetch referrals' });
  }
});
`;

code = code.replace(/app\.listen\(/, route + '\napp.listen(');
fs.writeFileSync('backend/server.js', code);
