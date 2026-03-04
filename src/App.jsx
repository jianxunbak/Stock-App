import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { StockDataProvider } from './hooks/useStockData';
import ScrollToTop from './components/ui/Navigation/ScrollToTop';
import InlineSpinner from './components/ui/InlineSpinner/InlineSpinner';

// Lazy load pages
const HeroPage = lazy(() => import('./components/pages/HeroPage/HeroPage'));
const AnalysisPage = lazy(() => import('./components/pages/AnalysisPage/AnalysisPage'));
const PortfolioPage = lazy(() => import('./components/pages/PortfolioPage/PortfolioPage'));
const WealthPage = lazy(() => import('./components/pages/WealthPage/WealthPage'));
import ProtectedRoute from './components/ProtectedRoute';


// Loading fallback
const PageLoader = () => (
  <div style={{
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--neu-bg)'
  }}>
    <InlineSpinner size="40px" />
  </div>
);

function App() {
  return (
    <StockDataProvider>
      <Router>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HeroPage />} />
            <Route path="/analysis" element={<ProtectedRoute><AnalysisPage /></ProtectedRoute>} />
            <Route path="/portfolio" element={<ProtectedRoute><PortfolioPage /></ProtectedRoute>} />
            <Route path="/wealth" element={<ProtectedRoute><WealthPage /></ProtectedRoute>} />
          </Routes>
        </Suspense>
        <ScrollToTop />
      </Router>
    </StockDataProvider>
  );
}

export default App;
