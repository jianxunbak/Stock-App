import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { StockDataProvider } from './hooks/useStockData';
import HeroPage from './components/pages/HeroPage/HeroPage';
import AnalysisPage from './components/pages/AnalysisPage/AnalysisPage';
import PortfolioPage from './components/pages/PortfolioPage/PortfolioPage';
import WealthPage from './components/pages/WealthPage/WealthPage';

import ScrollToTop from './components/ui/Navigation/ScrollToTop';

function App() {
  return (
    <StockDataProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HeroPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/wealth" element={<WealthPage />} />
        </Routes>
        <ScrollToTop />
      </Router>
    </StockDataProvider>
  );
}

export default App;
