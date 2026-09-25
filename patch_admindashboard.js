const fs = require('fs');
const file = 'frontend/src/components/AdminDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /} = useStore\(useShallow\(state => \(\{ fetchAdminUsers:/,
  ', toggleUserBan } = useStore(useShallow(state => ({ toggleUserBan: state.toggleUserBan, fetchAdminUsers:'
);

fs.writeFileSync(file, content);
