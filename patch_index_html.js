const fs = require('fs');
let html = fs.readFileSync('frontend/index.html', 'utf8');

const metaTags = `
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <script>
      // Aggressive cache breaking script
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
          for(let registration of registrations) {
            registration.unregister();
          }
        });
      }
      const lastVersion = localStorage.getItem('app_version');
      const currentVersion = 'v1.0.2'; // increment this
      if (lastVersion !== currentVersion) {
        localStorage.setItem('app_version', currentVersion);
        window.location.reload(true);
      }
    </script>
`;

if (!html.includes('app_version')) {
  html = html.replace('</head>', metaTags + '</head>');
  fs.writeFileSync('frontend/index.html', html);
  console.log("Added cache-busting script to index.html");
} else {
  console.log("Cache-busting script already present.");
}
