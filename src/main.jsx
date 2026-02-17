import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { WatchlistProvider } from './context/WatchlistContext.jsx'
import { checkAndMarkQuotaError } from './utils/firestoreUtils';

// Console suppression logic
const originalWarn = console.warn;
const originalError = console.error;

console.warn = (...args) => {
  // Feedback Loop: Catch Firestore backoff warnings from SDK background threads
  const isQuotaRelated = args.some(arg => checkAndMarkQuotaError(arg));

  if (isQuotaRelated) return; // Suppress

  const msg = args[0];
  if (typeof msg === 'string' && (
    msg.includes('width(-1) and height(-1) of chart should be greater than 0') ||
    msg.includes('defaultProps will be removed from function components')
  )) {
    return;
  }
  originalWarn(...args);
};

console.error = (...args) => {
  // Feedback Loop: Catch Firestore quota errors from SDK background threads
  const isQuotaRelated = args.some(arg => checkAndMarkQuotaError(arg));

  if (isQuotaRelated) return; // Suppress

  const msg = args[0];
  if (typeof msg === 'string' && (
    msg.includes('width(-1) and height(-1) of chart should be greater than 0') ||
    msg.includes('defaultProps will be removed from function components')
  )) {
    return;
  }
  originalError(...args);
};

if (import.meta.env.PROD) {
  console.log = () => { };
  console.warn = () => { };
  console.error = () => { };
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <WatchlistProvider>
          <App />
        </WatchlistProvider>
      </ThemeProvider>
    </AuthProvider>
  </StrictMode>,
)
