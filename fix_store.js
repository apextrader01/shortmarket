const fs = require('fs');
const file = 'frontend/src/store.js';
let content = fs.readFileSync(file, 'utf8');

const target = `  fetchAdminTelemetry: async () => {
    try {
      set({ loading: true });
      const res = await API.get('/api/admin/telemetry');
      set({ adminTelemetry: res.data, loading: false });
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to load telemetry', loading: false });
    }
  },`;

const replacement = `  fetchAdminTelemetry: async () => {
    try {
      set({ loading: true });
      const res = await fetch(\`\${API}/api/admin/telemetry\`, { credentials: 'omit' });
      const data = await res.json();
      set({ adminTelemetry: data, loading: false });
    } catch (err) {
      set({ error: err.message || 'Failed to load telemetry', loading: false });
    }
  },`;

content = content.replace(target, replacement);

fs.writeFileSync(file, content);
