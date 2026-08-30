const fs = require('fs');
let app = fs.readFileSync('frontend/src/App.jsx', 'utf8');

if (app.includes('<BackgroundWatcher />')) {
    app = app.replace('<BackgroundWatcher />', '{/* <BackgroundWatcher /> */}');
    fs.writeFileSync('frontend/src/App.jsx', app);
    console.log("Commented out BackgroundWatcher.");
} else {
    console.log("Could not find BackgroundWatcher.");
}
