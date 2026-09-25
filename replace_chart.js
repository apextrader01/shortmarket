const fs = require('fs');
let content = fs.readFileSync('frontend/src/components/ChartWidget.jsx', 'utf8');

const searchBtn = `function IndicatorButton({ label, active, onClick, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        background: active ? \`\${color}20\` : 'transparent',
        color: active ? color : '#64748B',
        border: \`1px solid \${active ? color : 'rgba(255,255,255,0.1)'}\`,
        borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: 'bold',
        cursor: 'pointer', transition: 'all 0.2s'
      }}
    >`;

const replaceBtn = `function IndicatorButton({ label, active, onClick, color }) {
  return (
    <button
      onClick={onClick}
      className={\`chart-tool-pill \${active ? 'active' : ''}\`}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '4px 12px', fontSize: '11px', fontWeight: 'bold',
        cursor: 'pointer'
      }}
    >`;

content = content.replace(searchBtn, replaceBtn);
fs.writeFileSync('frontend/src/components/ChartWidget.jsx', content);
console.log('done chartwidget');
