const fs = require('fs');
const file = 'frontend/src/store.js';
let content = fs.readFileSync(file, 'utf8');

const target = `adminLedger: [],`;
const replacement = `adminLedger: [],
  adminTelemetry: { api: [], users: [] },`;
content = content.replace(target, replacement);

const target2 = `fetchAdminLedger: async () => {`;
const replacement2 = `fetchAdminTelemetry: async () => {
    try {
      set({ loading: true });
      const res = await API.get('/api/admin/telemetry');
      set({ adminTelemetry: res.data, loading: false });
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to load telemetry', loading: false });
    }
  },

  fetchAdminLedger: async () => {`;
content = content.replace(target2, replacement2);

fs.writeFileSync(file, content);
