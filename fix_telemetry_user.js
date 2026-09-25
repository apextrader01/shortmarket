const fs = require('fs');
const file = 'backend/middleware/telemetry.js';
let content = fs.readFileSync(file, 'utf8');

const target = `const userId = (req.user && req.user.id) ? req.user.id : 'anonymous';`;
const replacement = `
            let userId = 'anonymous';
            if (req.user && req.user.id) {
                userId = req.user.id;
            } else {
                // Try to manually decode token if present so we can track users even on routes where authenticateToken isn't applied globally
                const jwt = require('jsonwebtoken');
                const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_shortmarket_key_2026';
                const token = (req.cookies && req.cookies.token) || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);
                if (token) {
                    try {
                        const decoded = jwt.verify(token, JWT_SECRET);
                        if (decoded && decoded.id) userId = decoded.id;
                    } catch(e) {}
                }
            }
`;
content = content.replace(target, replacement);

fs.writeFileSync(file, content);
