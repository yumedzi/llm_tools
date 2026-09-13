import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { RotateCcw } from 'lucide-react';
import '@fontsource/silkscreen/400.css';
import './styles.css';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {failed: boolean}> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <main style={{padding: 40, color: '#eee', background: '#101018', minHeight: '100vh'}}><h1>Let’s try that again.</h1><p>Your browser may have restored an incompatible experiment. Reload to retry, or clear this site’s saved data in browser settings.</p><button onClick={() => location.reload()}><RotateCcw size={16} aria-hidden="true" /> Reload studio</button></main> : this.props.children; }
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><App /></ErrorBoundary></React.StrictMode>);
