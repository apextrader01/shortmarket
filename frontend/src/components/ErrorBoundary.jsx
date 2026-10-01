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
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            padding: '32px 16px',
            textAlign: 'center',
            color: 'var(--text-primary, #ffffff)'
          }}
        >
          <div
            style={{
              background: 'var(--bg-card, #1e222d)',
              border: '1px solid var(--border-color, #2a2e39)',
              borderRadius: '16px',
              padding: '28px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 16px 32px rgba(0,0,0,0.3)'
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                fontSize: '26px'
              }}
            >
              ⚠️
            </div>

            <h3
              style={{
                fontSize: '18px',
                fontWeight: '700',
                marginBottom: '8px'
              }}
            >
              Component Temporarily Unavailable
            </h3>

            <p
              style={{
                fontSize: '13.5px',
                color: 'var(--text-secondary, #94a3b8)',
                lineHeight: '1.5',
                marginBottom: '20px'
              }}
            >
              A temporary display error occurred. Your orders, portfolio, and funds remain fully secure and unaffected.
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '10px 18px',
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Reload Platform
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null, errorInfo: null });
                  window.location.href = '/';
                }}
                style={{
                  padding: '10px 18px',
                  background: 'transparent',
                  color: 'var(--text-primary, #ffffff)',
                  border: '1px solid var(--border-color, #333)',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Go to Dashboard
              </button>
            </div>

            {this.state.error && (
              <details
                style={{
                  marginTop: '18px',
                  textAlign: 'left',
                  fontSize: '11px',
                  color: 'var(--text-secondary, #64748b)',
                  background: 'rgba(0,0,0,0.2)',
                  padding: '8px 12px',
                  borderRadius: '6px'
                }}
              >
                <summary style={{ cursor: 'pointer', fontWeight: '600' }}>Technical Details</summary>
                <p style={{ margin: '6px 0 0 0', wordBreak: 'break-all' }}>{this.state.error.toString()}</p>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;


