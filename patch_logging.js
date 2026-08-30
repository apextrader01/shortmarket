const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

code = code.replace(
  "app.get('/api/stocks/:symbol/details', async (req, res) => {",
  "app.get('/api/stocks/:symbol/details', async (req, res) => {\n  console.log('[API DETAILS FETCH]', req.params.symbol);\n  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');"
);

code = code.replace(
  "    if (isDerivative) {\n      return res.json({",
  "    if (isDerivative) {\n      console.log('[API DETAILS] Mocked as derivative:', symbol);\n      return res.json({"
);

code = code.replace(
  "    stockDetailsCache[rawName] = { timestamp: Date.now(), data };\n    res.json(data);",
  "    stockDetailsCache[rawName] = { timestamp: Date.now(), data };\n    console.log('[API DETAILS] Success for:', symbol, 'Found:', !!data.details);\n    res.json(data);"
);

fs.writeFileSync('backend/server.js', code);
console.log("Added logging to details route");
