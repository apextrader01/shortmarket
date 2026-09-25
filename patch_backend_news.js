const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

const fetchGoogleNewsCode = `
async function fetchGoogleNews(symbol) {
  try {
    const q = encodeURIComponent(symbol + ' stock NSE');
    const res = await fetch(\`https://news.google.com/rss/search?q=\${q}\`);
    const xml = await res.text();
    const items = [];
    const itemRegex = /<item>([\\s\\S]*?)<\\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
      const itemXml = match[1];
      const titleMatch = itemXml.match(/<title>([\\s\\S]*?)<\\/title>/);
      const linkMatch = itemXml.match(/<link>([\\s\\S]*?)<\\/link>/);
      const pubDateMatch = itemXml.match(/<pubDate>([\\s\\S]*?)<\\/pubDate>/);
      const sourceMatch = itemXml.match(/<source[^>]*>([\\s\\S]*?)<\\/source>/);
      
      if (titleMatch && linkMatch) {
        let title = titleMatch[1].replace(/<!\\[CDATA\\[(.*?)\\]\\]>/, '$1').replace(/&amp;/g, '&');
        let publisher = sourceMatch ? sourceMatch[1] : 'News';
        if (title.includes(' - ')) {
          const parts = title.split(' - ');
          if (!sourceMatch) publisher = parts.pop();
          else parts.pop();
          title = parts.join(' - ');
        }
        
        let providerPublishTime = Math.floor(Date.now()/1000);
        if (pubDateMatch) {
           const d = new Date(pubDateMatch[1]);
           if (!isNaN(d.getTime())) providerPublishTime = Math.floor(d.getTime()/1000);
        }
        
        items.push({
          title,
          link: linkMatch[1],
          publisher,
          providerPublishTime
        });
      }
    }
    return items;
  } catch (err) {
    console.error('Google News error:', err);
    return [];
  }
}
`;

// Insert the function above the route
if (!code.includes('fetchGoogleNews')) {
    code = code.replace(
        'app.get(\'/api/stocks/:symbol/details\', async (req, res) => {',
        fetchGoogleNewsCode + '\napp.get(\'/api/stocks/:symbol/details\', async (req, res) => {'
    );
}

// Replace the data.news = [] with fetching
code = code.replace(
    'data.news = []; // Removed Yahoo finance completely',
    'data.news = await fetchGoogleNews(rawName); // Replaced with Google News RSS'
);

fs.writeFileSync('backend/server.js', code, 'utf8');
console.log('Patched backend for Google News');
