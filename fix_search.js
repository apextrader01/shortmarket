const fs = require('fs');
let server = fs.readFileSync('backend/server.js', 'utf8');

const oldCode = `    let query = db('users').leftJoin('user_profiles', 'users.id', 'user_profiles.user_id');
    let countQuery = db('users');

    if (search) {
      query = query.where('users.username', 'ilike', \`%\${search}%\`)
                   .orWhere('users.email', 'ilike', \`%\${search}%\`)
                   .orWhere('users.client_id', 'ilike', \`%\${search}%\`);
                   
      countQuery = countQuery.where('username', 'ilike', \`%\${search}%\`)
                             .orWhere('email', 'ilike', \`%\${search}%\`)
                             .orWhere('client_id', 'ilike', \`%\${search}%\`);
    }

    const [countResult] = await countQuery.count('id as total');
    const total = countResult ? parseInt(countResult.total) : 0;

    const users = await query
      .select('users.id', 'users.client_id', 'users.username', 'users.email', 'users.balance', 'users.phone', 'users.pan_card', 'users.aadhar_number', 'users.kyc_pan_url', 'users.kyc_aadhar_url', 'users.is_admin', 'users.created_at', 'user_profiles.dob', 'user_profiles.gender', 'user_profiles.state', 'user_profiles.city', 'user_profiles.occupation', 'user_profiles.annual_income', 'user_profiles.financial_goal', 'user_profiles.trading_experience', 'user_profiles.preferred_segment', 'user_profiles.trading_style')
      .orderBy('users.created_at', 'desc')
      .limit(limit)
      .offset(offset);`;

const newCode = `    let query = db('users');
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
      .offset(offset);`;

server = server.replace(oldCode, newCode);
fs.writeFileSync('backend/server.js', server);
console.log("Fixed Admin Client Search API!");
