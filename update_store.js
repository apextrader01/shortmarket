const fs = require('fs');
let content = fs.readFileSync('frontend/src/store.js', 'utf8');

content = content.replace("theme: 'dark', // default to dark", 
`theme: 'dark', // default to dark
  fontSize: 'medium',
  accessibilityMode: false,
  setFontSize: (size) => set((state) => {
    document.body.classList.remove('font-small', 'font-medium', 'font-large');
    document.body.classList.add('font-' + size);
    return { fontSize: size };
  }),
  setAccessibilityMode: (mode) => set({ accessibilityMode: mode }),`);

// Now add it to partialize block
content = content.replace("theme:             state.theme,", `theme:             state.theme,
      fontSize:          state.fontSize,
      accessibilityMode: state.accessibilityMode,`);

fs.writeFileSync('frontend/src/store.js', content);
console.log('Store updated');
