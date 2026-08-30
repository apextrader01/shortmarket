const fs = require('fs');
const file = 'frontend/src/components/AdminDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

const target = `<td style={{ padding: '16px', textAlign: 'right' }}>
                        <button`;
const replacement = `<td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button`;

const targetEnd = `</button>
                      </td>
                    </tr>`;
const replacementEnd = `</button>
                        </div>
                      </td>
                    </tr>`;

content = content.replace(target, replacement);
content = content.replace(targetEnd, replacementEnd);
fs.writeFileSync(file, content);
