import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';
import './print.css';

// Emergency Fix: Force global adminTheme availability for legacy code safety
import { adminTheme } from './lib/adminTheme';
(window as any).adminTheme = adminTheme;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
