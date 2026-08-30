const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

const sipDateLogic = `
      let nextExecutionDate = new Date();
      if (frequency === 'DAILY') {
        nextExecutionDate.setDate(nextExecutionDate.getDate() + 1);
      } else if (frequency === 'WEEKLY') {
        nextExecutionDate.setDate(nextExecutionDate.getDate() + 7);
      } else {
        nextExecutionDate.setMonth(nextExecutionDate.getMonth() + 1);
      }
      
      // Ensure it's not Saturday/Sunday (skips to Monday)
      while (nextExecutionDate.getDay() === 0 || nextExecutionDate.getDay() === 6) {
          nextExecutionDate.setDate(nextExecutionDate.getDate() + 1);
      }
`;

code = code.replace(
    /const nextExecutionDate = new Date\(\);\s*nextExecutionDate\.setMonth\(nextExecutionDate\.getMonth\(\) \+ 1\);/,
    sipDateLogic
);

// I also accidentally defined `const triggerEngine` twice in the previous replacement. Let's fix that.
code = code.replace(
    /const triggerEngine = require\('\.\/services\/triggerEngine'\);\s*const triggerEngine = require\('\.\/services\/triggerEngine'\);/,
    'const triggerEngine = require(\'./services/triggerEngine\');'
);

fs.writeFileSync('backend/server.js', code, 'utf8');
console.log('Patched date logic');
