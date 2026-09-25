const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/LoginView.jsx', 'utf8');

// Insert a useEffect at the top of LoginView to catch ?ref=
if (!code.includes('localStorage.setItem("referral_code"')) {
    const hook = `
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    if (ref) {
      localStorage.setItem('referral_code', ref);
    }
  }, []);
`;
    // Find the line after "const [view, setView] = useState('login');"
    code = code.replace(/const \[view, setView\] = useState\('login'\);/, "const [view, setView] = useState('login');" + hook);
    fs.writeFileSync('frontend/src/components/LoginView.jsx', code);
}
