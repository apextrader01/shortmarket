const jwt = require('jsonwebtoken');
const token = jwt.sign({ id: 1, username: 'admin' }, 'super_secret_shortmarket_key_2026'); // Assuming 1 is admin

fetch('http://localhost:5000/api/admin/telemetry', {
  headers: { Authorization: `Bearer ${token}` }
}).then(r => r.text()).then(console.log).catch(console.error);
