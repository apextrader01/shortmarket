const fs = require('fs');
let server = fs.readFileSync('backend/server.js', 'utf8');

// The problematic block contains "query = db('users').leftJoin('user_profiles', 'users.id', 'user_profiles.user_id');"
// Let's replace the whole /api/admin/users route

let routeStart = server.indexOf(`app.get('/api/admin/users'`);
if (routeStart !== -1) {
    let routeEnd = server.indexOf(`});`, routeStart) + 3;
    let oldRoute = server.substring(routeStart, routeEnd);
    
    let newRoute = `app.get('/api/admin/users', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    let query = db('users');
    let countQuery = db('users');

    if (search) {
      query = query.where('users.username', 'ilike', \`%\${search}%\`)
                   .orWhere('users.email', 'ilike', \`%\${search}%\`)
                   .orWhere('users.phone', 'ilike', \`%\${search}%\`);
                   
      countQuery = countQuery.where('username', 'ilike', \`%\${search}%\`)
                             .orWhere('email', 'ilike', \`%\${search}%\`)
                             .orWhere('phone', 'ilike', \`%\${search}%\`);
    }

    const [countResult] = await countQuery.count('id as total');
    const total = countResult ? parseInt(countResult.total) : 0;

    const users = await query
      .select('users.id', 'users.username', 'users.email', 'users.balance', 'users.phone', 'users.pan_card', 'users.aadhar_number', 'users.kyc_pan_url', 'users.kyc_aadhar_url', 'users.is_admin', 'users.subscription_tier', 'users.subscription_expires', 'users.created_at')
      .orderBy('users.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    res.json({ users, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("Admin Users Error:", err);
    res.status(500).json({ error: err.message });
  }
});`;

    server = server.replace(oldRoute, newRoute);
    fs.writeFileSync('backend/server.js', server);
    console.log("Successfully patched API endpoint");
} else {
    console.log("Could not find start of /api/admin/users");
}
