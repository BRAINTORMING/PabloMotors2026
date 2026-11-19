import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProviders } from './providers';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

/** Supabase's auth-js uses the browser Locks API, which is denied in some preview contexts.
    Swallow that specific rejection so it does not crash the app as an unhandled promise rejection. */
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const msg = event.reason?.message ?? String(event.reason ?? '');
    if (msg.includes('LockManager') || msg.includes('Access to the Locks API')) {
      event.preventDefault();
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppProviders>
        <App />
      </AppProviders>
    </ErrorBoundary>
  </React.StrictMode>,
);
