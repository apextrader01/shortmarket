const fs = require('fs');
let css = fs.readFileSync('frontend/src/index.css', 'utf8');

// Add glassy panel class
if (!css.includes('.glass-panel')) {
    css += \n
/* --- Modern Glassy Aesthetics --- */
.glass-panel {
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
}

.neon-text-blue {
  text-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
}

.neon-text-green {
  text-shadow: 0 0 10px rgba(34, 197, 94, 0.5);
}

.neon-text-red {
  text-shadow: 0 0 10px rgba(239, 68, 68, 0.5);
}

.hover-glow:hover {
  box-shadow: 0 0 15px rgba(59, 130, 246, 0.3);
  border-color: rgba(59, 130, 246, 0.4);
  transition: all 0.3s ease;
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: rgba(0,0,0,0.2); 
}
::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.1); 
  border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255,255,255,0.2); 
}
;
    fs.writeFileSync('frontend/src/index.css', css, 'utf8');
}
console.log('CSS Updated!');
