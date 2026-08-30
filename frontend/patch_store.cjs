const fs = require('fs');
let content = fs.readFileSync('src/store.js', 'utf8');

const updateAlertTarget = `  updateAlert: (id, updates) => set((state) => ({ 
    alerts: state.alerts.map(a => a.id === id ? { ...a, ...updates } : a) 
  })),`;

const updateAlertReplacement = `  updateAlert: (id, updates) => set((state) => {
    let changed = false;
    const newAlerts = state.alerts.map(a => {
      if (a.id === id) { changed = true; return { ...a, ...updates }; }
      return a;
    });
    return changed ? { alerts: newAlerts } : {};
  }),`;

const updatePendingTarget = `  updatePendingTrigger: (id, updates) => set((state) => ({
    pendingTriggers: state.pendingTriggers.map(t => t.id === id ? { ...t, ...updates } : t)
  })),`;

const updatePendingReplacement = `  updatePendingTrigger: (id, updates) => set((state) => {
    let changed = false;
    const newTriggers = state.pendingTriggers.map(t => {
      if (t.id === id) { changed = true; return { ...t, ...updates }; }
      return t;
    });
    return changed ? { pendingTriggers: newTriggers } : {};
  }),`;

content = content.replace(updateAlertTarget, updateAlertReplacement);
content = content.replace(updatePendingTarget, updatePendingReplacement);
fs.writeFileSync('src/store.js', content);
