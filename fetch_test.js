const fetchAll = async () => {
  let masterFound = false;
  for (let i = 0; i < 20; i++) {
    const r = await fetch('https://34-93-99-22.nip.io/api/fyers-debug');
    const t = await r.text();
    if (t.includes('"isMasterNode":true')) {
      masterFound = true;
      console.log(t);
      break;
    }
  }
  console.log('Master found:', masterFound);
};
fetchAll();
