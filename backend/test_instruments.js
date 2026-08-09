require('./database/db');
require('./services/instruments');
setTimeout(() => {
    console.log("Done");
    process.exit(0);
}, 10000);
