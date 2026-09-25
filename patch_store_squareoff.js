const fs = require('fs');
const file = 'frontend/src/store.js';
let content = fs.readFileSync(file, 'utf8');

const replacement = `
  adminMasterSquareOff: async () => {
    try {
      const res = await fetch(\`\${API}/api/admin/master_square_off\`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        return data;
      } else {
        throw new Error(data.error || 'Failed to trigger Master Square-Off');
      }
    } catch(err) {
      console.error(err);
      throw err;
    }
  },

  fetchAdminUsers`;

content = content.replace("fetchAdminUsers", replacement);
fs.writeFileSync(file, content);
