const fs = require('fs');

// 1. In ClientDataView - add local showReferrals state and render ReferralsView inline
let cdv = fs.readFileSync('frontend/src/components/ClientDataView.jsx', 'utf8');

// Add import for ReferralsView at top
if (!cdv.includes("import ReferralsView")) {
  cdv = cdv.replace(
    "export default function ClientDataView",
    "import ReferralsView from './ReferralsView';\n\nexport default function ClientDataView"
  );
}

// Add local state after existing states
if (!cdv.includes('showReferrals')) {
  cdv = cdv.replace(
    "const [showHotkeysModal, setShowHotkeysModal] = useState(false);",
    "const [showHotkeysModal, setShowHotkeysModal] = useState(false);\n  const [showReferrals, setShowReferrals] = useState(false);"
  );
}

// Change the Refer card onClick
cdv = cdv.replace(
  "onClick={() => setActiveTab('Referrals')}",
  "onClick={() => setShowReferrals(true)}"
);

// Add the inline render before the closing </div> of the component
// Find the last </div> before the final closing and add the inline view
cdv = cdv.replace(
  "</div>\n\n\n",
  `</div>

      {/* Referrals Full View */}
      {showReferrals && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--bg-dark)', zIndex: 100, overflowY: 'auto' }}>
          <ReferralsView setActiveTab={() => setShowReferrals(false)} isModal={true} />
        </div>
      )}

`
);

fs.writeFileSync('frontend/src/components/ClientDataView.jsx', cdv);
