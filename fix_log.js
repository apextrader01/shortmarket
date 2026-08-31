const fs = require('fs');
const file = 'backend/middleware/telemetry.js';
let content = fs.readFileSync(file, 'utf8');

const target = `} catch (err) {
            // Silently fail
        }`;
const replacement = `} catch (err) {
            console.error("TELEMETRY ERROR:", err);
        }`;
content = content.replace(target, replacement);

fs.writeFileSync(file, content);
