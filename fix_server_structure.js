const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

// 1. Remove the misplaced catch block around line 3086
code = code.replace(
  "  } catch (error) {\r\n    console.error('Error fetching referrals:', error);\r\n    res.status(500).json({ error: 'Failed to fetch referrals' });\r\n  }\r\n});",
  ""
);
// Try Linux endings if CRLF didn't match
code = code.replace(
  "  } catch (error) {\n    console.error('Error fetching referrals:', error);\n    res.status(500).json({ error: 'Failed to fetch referrals' });\n  }\n});",
  ""
);

// 2. Add the proper catch block to the end of the referrals route
code = code.replace(
  "        totalCount: referrals.length\n      }\n    });\n\napp.use((req, res) => {",
  "        totalCount: referrals.length\n      }\n    });\n  } catch (err) {\n    res.status(500).json({ error: err.message });\n  }\n});\n\napp.use((req, res) => {"
);
code = code.replace(
  "        totalCount: referrals.length\r\n      }\r\n    });\r\n\r\napp.use((req, res) => {",
  "        totalCount: referrals.length\r\n      }\r\n    });\r\n  } catch (err) {\r\n    res.status(500).json({ error: err.message });\r\n  }\r\n});\r\n\r\napp.use((req, res) => {"
);

fs.writeFileSync('backend/server.js', code);
console.log("Fixed server.js structure.");
