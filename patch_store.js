const fs = require('fs');
const file = 'frontend/src/store.js';
let content = fs.readFileSync(file, 'utf8');

const target = /fetchAdminUsers: async \(page = 1, limit = 50, search = ''\) => \{/;
const replacement = `toggleUserBan: async (userId) => {
    try {
      const res = await fetch(\`\${API}/api/admin/users/\${userId}/toggle_ban\`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        // Refresh admin users list after ban status changes
        get().fetchAdminUsers();
        return data;
      } else {
        throw new Error(data.error || 'Failed to toggle ban');
      }
    } catch(err) {
      console.error(err);
      throw err;
    }
  },

  fetchAdminUsers: async (page = 1, limit = 50, search = '') => {`;

content = content.replace(target, replacement);
fs.writeFileSync(file, content);
