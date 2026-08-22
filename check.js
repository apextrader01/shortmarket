fetch('https://34-93-99-22.nip.io/').then(r => r.text()).then(t => { 
  const match = t.match(/src="([^"]+)"/); 
  if (match) { 
    console.log('Bundle:', match[1]); 
    fetch('https://34-93-99-22.nip.io' + match[1]).then(r2 => console.log('Bundle status:', r2.status)); 
  } else console.log('No script tag found'); 
});
