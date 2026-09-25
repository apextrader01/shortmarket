const fs = require('fs');

function fixFile(filepath) {
  let content = fs.readFileSync(filepath, 'utf8');
  const lines = content.split('\n');
  
  // Find lines with useShallow that contain actions
  const actionPrefixes = ['state.set', 'state.load', 'state.open', 'state.fetch', 
    'state.place', 'state.logout', 'state.init', 'state.create', 'state.delete',
    'state.update', 'state.remove', 'state.close', 'state.add', 'state.toggle',
    'state.clear', 'state.refresh', 'state.submit'];
  
  let changed = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('useShallow')) continue;
    const hasAction = actionPrefixes.some(p => line.includes(p));
    if (!hasAction) continue;
    
    // This is a problematic line. Parse out state keys and separate actions from state
    // Pattern: state.XYZ: state.XYZ (repeated)
    const stateKeys = [];
    const re = /state\.(\w+)/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      stateKeys.push(m[1]);
    }
    
    const uniqueKeys = [...new Set(stateKeys)];
    const actionKeys = uniqueKeys.filter(k => 
      k.startsWith('set') || k.startsWith('load') || k.startsWith('open') || 
      k.startsWith('fetch') || k.startsWith('place') || k.startsWith('logout') ||
      k.startsWith('init') || k.startsWith('create') || k.startsWith('delete') ||
      k.startsWith('update') || k.startsWith('remove') || k.startsWith('close') ||
      k.startsWith('add') || k.startsWith('toggle') || k.startsWith('clear') ||
      k.startsWith('refresh') || k.startsWith('submit') || k.startsWith('rename') ||
      k.startsWith('exit') || k.startsWith('cancel') || k.startsWith('connect') ||
      k.startsWith('disconnect') || k.startsWith('reset') || k.startsWith('handle')
    );
    const stateOnlyKeys = uniqueKeys.filter(k => !actionKeys.includes(k));
    
    if (actionKeys.length === 0) continue;
    
    // Find the destructured variable names from the line
    // Pattern: const { a, b, c } = useStore(useShallow...)
    const destructureMatch = line.match(/const\s*\{([^}]+)\}/);
    if (!destructureMatch) { console.log('SKIP (no destructure):', filepath, 'L' + (i+1)); continue; }
    
    const varNames = destructureMatch[1].split(',').map(v => v.trim()).filter(Boolean);
    const actionVarNames = varNames.filter(v => actionKeys.includes(v));
    const stateVarNames = varNames.filter(v => !actionKeys.includes(v));
    
    if (stateVarNames.length === 0) {
      // All vars are actions - no useShallow needed at all
      const actionLines = actionVarNames.map(v => 
        `  const ${v} = useStore(state => state.${v}); // [HOTFIX] action, not state`
      ).join('\n');
      lines[i] = `  // [HOTFIX] All actions — removed from useShallow to prevent Error #185\n` + actionLines;
    } else {
      // Mix — split state vars into useShallow, action vars separate
      const indent = line.match(/^(\s*)/)[1];
      const stateShallow = `${indent}// [HOTFIX] Actions separated from state to prevent Error #185 render loops\n${indent}const { ${stateVarNames.join(', ')} } = useStore(useShallow(state => ({ ${stateVarNames.map(v => `${v}: state.${v}`).join(', ')} })));`;
      const actionLines = actionVarNames.map(v => `${indent}const ${v} = useStore(state => state.${v});`).join('\n');
      lines[i] = stateShallow + '\n' + actionLines;
    }
    changed = true;
    console.log('FIXED:', filepath, 'L' + (i+1), '- extracted actions:', actionVarNames.join(', '));
  }
  
  if (changed) {
    fs.writeFileSync(filepath, lines.join('\n'));
  }
  return changed;
}

const targets = [
  'src/App.jsx',
  'src/components/OrderModal.jsx',
  'src/components/BasketModal.jsx',
  'src/components/MarketDepthModal.jsx',
  'src/components/EditOrderModal.jsx',
  'src/components/OrdersView.jsx',
  'src/components/SettingsView.jsx',
  'src/components/OptionChainView.jsx',
];

targets.forEach(t => fixFile(t));
console.log('Done!');
