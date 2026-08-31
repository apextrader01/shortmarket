const fs = require('fs');
const file = 'frontend/src/components/AdminDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

const target = `<div style={{ display: 'flex', gap: '16px', marginTop: '16px', overflowX: 'auto' }} className="scrollbar-hide">`;
const replacement = `<div style={{ display: 'flex', gap: '16px', marginTop: '16px', flexWrap: 'wrap' }}>`;
content = content.replace(target, replacement);

fs.writeFileSync(file, content);
