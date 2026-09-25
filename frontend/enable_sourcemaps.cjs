const fs = require('fs');
let config = fs.readFileSync('vite.config.js', 'utf8');
if (!config.includes('sourcemap: true')) {
    config = config.replace('build: {', 'build: { sourcemap: true,');
    fs.writeFileSync('vite.config.js', config);
}
