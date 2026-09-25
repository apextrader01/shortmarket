import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'

// Automatically reload when a dynamic import fails due to a new deployment / asset hash change
window.addEventListener('vite:preloadError', (event) => {
  console.warn('New deployment detected, reloading page to fetch updated assets...');
  const lastReload = parseInt(sessionStorage.getItem('last_chunk_reload') || '0', 10);
  if (Date.now() - lastReload > 10000) {
    sessionStorage.setItem('last_chunk_reload', String(Date.now()));
    window.location.reload();
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
