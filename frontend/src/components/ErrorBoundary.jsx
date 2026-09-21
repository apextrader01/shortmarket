import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("ErrorBoundary caught an error", error, errorInfo);

    // If dynamic chunk loading failed due to a new deployment, auto-reload once to fetch new bundle
    const msg = error?.message || String(error || '');
    if (
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('dynamically imported module') ||
      msg.includes('Loading chunk') ||
      msg.includes('Importing a module script failed')
    ) {
      const lastReload = parseInt(sessionStorage.getItem('last_chunk_reload') || '0', 10);
      if (Date.now() - lastReload > 10000) {
        sessionStorage.setItem('last_chunk_reload', String(Date.now()));
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message || String(this.state.error || '');
      const isChunkError = 
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('dynamically imported module') ||
        msg.includes('Loading chunk') ||
        msg.includes('Importing a module script failed');

      if (isChunkError) {
        return (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            padding: '32px',
            textAlign: 'center',
            color: 'var(--text-primary, #fff)'
          }}>
            <div style={{
              background: 'rgba(37, 99, 235, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '16px',
              padding: '24px 32px',
              maxWidth: '480px'
            }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '700' }}>Platform Updated</h3>
              <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: 'var(--text-secondary, #94a3b8)' }}>
                A new version of SkandX has been deployed. Please refresh to load the latest trading components.
              </p>
              <button
                onClick={() => window.location.reload()}
                style={{
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Refresh Now
              </button>
            </div>
          </div>
        );
      }

      return (
        <div style={{ padding: '20px', background: '#330000', color: '#ffaaaa', borderRadius: '8px', margin: '20px' }}>
          <h2>Component Crashed</h2>
          <p><strong>Error:</strong> {this.state.error && this.state.error.toString()}</p>
          <details style={{ whiteSpace: 'pre-wrap', marginTop: '10px' }}>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '16px',
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Reload Platform
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;


