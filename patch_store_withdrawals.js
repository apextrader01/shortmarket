const fs = require('fs');
const file = 'frontend/src/store.js';
let content = fs.readFileSync(file, 'utf8');

const replacement = `
  updateBankDetails: async (details) => {
    try {
      const res = await fetch(\`\${API}/api/user/bank_details\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(details),
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        set({ user: { ...get().user, ...details } });
        return data;
      } else {
        throw new Error(data.error);
      }
    } catch(err) {
      throw err;
    }
  },

  requestWithdrawal: async (amount) => {
    try {
      const res = await fetch(\`\${API}/api/withdrawals/request\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        return data;
      } else {
        throw new Error(data.error);
      }
    } catch(err) {
      throw err;
    }
  },

  fetchAdminWithdrawals: async () => {
    try {
      const res = await fetch(\`\${API}/api/admin/withdrawals\`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) return data.withdrawals;
      return [];
    } catch (e) {
      console.error(e);
      return [];
    }
  },

  processAdminWithdrawal: async (id, status) => {
    try {
      const res = await fetch(\`\${API}/api/admin/withdrawals/\${id}/process\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data;
    } catch(err) {
      throw err;
    }
  },

  updateUserDetails`;

content = content.replace("updateUserDetails", replacement);
fs.writeFileSync(file, content);
