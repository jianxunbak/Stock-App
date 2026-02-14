import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext.jsx';
import GlobalFilters from './components/Animator/GlobalFilters';
import Button from './components/Button';

import StockHeader from './components/StockHeader';
import StockHealthCard from './components/StockHealthCard/StockHealthCard';
import ExpandableCard from './components/ExpandableCard/ExpandableCard';
import PriceChartCard from './components/PriceChartCard/PriceChartCard';
import { Zap, Briefcase, Moon, Sun, TrendingUp, Edit2, Trash2 } from 'lucide-react';
import Menu from './components/Menu';
import './components/StockSummary/StockSummary.css';
import './App.css';
import TableChart from './components/TableChart/TableChart';
import VerticalBarChart from './components/VerticalBarChart/VerticalBarChart';
import FinancialStatementsTable from './components/FinancialStatementsTable/FinancialStatementsTable';
import SideDrawer from './components/SideDrawer/SideDrawer';
import { User, List, Settings, LogOut } from 'lucide-react';
import PortfolioDistribution from './components/PortfolioDistribution/PortfolioDistribution';
import LoadingScreen from './components/LoadingScreen/LoadingScreen';

const stocks = [
  {
    name: "NVIDIA Corporation",
    ticker: "NVDA",
    price: "822.46",
    change: "+15.34",
    changePercent: "1.90%",
    beta: "1.68",
    costBasis: "420.50",
    costBasisDate: "2023-05-15",
    totalValue: "12336.90",
    fiveYearGrowth: "58.2",
    category: "Semiconductors",
    healthScore: 82,
    healthItems: [
      { label: "Revenue Growth", status: "pass" },
      { label: "Net Margin", status: "pass" },
      { label: "Debt/Equity", status: "pass" },
      { label: "Free Cash Flow", status: "pass" },
      { label: "ROIC > 15%", status: "pass" },
      { label: "P/E vs 5Y Avg", status: "fail" },
      { label: "PEG Ratio", status: "pass" },
      { label: "Current Ratio", status: "pass" },
      { label: "FCF Yield", status: "fail" },
      { label: "Insider Buying", status: "fail" },
      { label: "Analyst Growth", status: "pass" },
      { label: "Market Dominance", status: "pass" },
      { label: "Gross Margin", status: "pass" },
      { label: "Dividend Safety", status: "pass" }
    ],
    chartData: [620, 680, 650, 720, 780, 760, 810, 822],
    priceHistory: [
      { date: 'Jan', price: 600 },
      { date: 'Feb', price: 650 },
      { date: 'Mar', price: 720 },
      { date: 'Apr', price: 780 },
      { date: 'May', price: 810 },
      { date: 'Jun', price: 822 },
    ]
  },
  // {
  //   name: "Tesla, Inc.",
  //   ticker: "TSLA",
  //   price: "193.57",
  //   change: "-4.12",
  //   changePercent: "-2.08%",
  //   beta: "2.14",
  //   costBasis: "210.00",
  //   costBasisDate: "2022-11-20",
  //   totalValue: "5807.10",
  //   fiveYearGrowth: "124.5",
  //   category: "EV / Auto",
  //   healthScore: 68,
  //   healthItems: [
  //     { label: "Revenue Growth", status: "pass" },
  //     { label: "Operating Margin", status: "fail" },
  //     { label: "Cash Reserves", status: "pass" },
  //     { label: "Market Share", status: "pass" },
  //     { label: "Production Scale", status: "pass" },
  //     { label: "R&D Efficiency", status: "fail" },
  //     { label: "Legal Risks", status: "fail" },
  //     { label: "CEO Alignment", status: "fail" },
  //     { label: "Inventory Turn", status: "pass" },
  //     { label: "Debt Coverage", status: "pass" },
  //     { label: "Gov Incentives", status: "pass" },
  //     { label: "Brand Strength", status: "pass" },
  //     { label: "Future AI Potential", status: "pass" },
  //     { label: "Gross Profit", status: "fail" }
  //   ],
  //   chartData: [220, 215, 205, 198, 190, 195, 192, 193],
  //   priceHistory: [
  //     { date: 'Jan', price: 230 },
  //     { date: 'Feb', price: 215 },
  //     { date: 'Mar', price: 200 },
  //     { date: 'Apr', price: 180 },
  //     { date: 'May', price: 195 },
  //     { date: 'Jun', price: 193 },
  //   ]
  // },
  // {
  //   name: "Microsoft Corp.",
  //   ticker: "MSFT",
  //   price: "415.50",
  //   change: "+2.80",
  //   changePercent: "0.68%",
  //   beta: "0.89",
  //   costBasis: "310.25",
  //   costBasisDate: "2023-01-10",
  //   totalValue: "18697.50",
  //   fiveYearGrowth: "24.1",
  //   category: "Software",
  //   healthScore: 10,
  //   healthItems: [
  //     { label: "Azure Growth", status: "pass" },
  //     { label: "Office 365 Sub", status: "pass" },
  //     { label: "AI Integration", status: "pass" },
  //     { label: "Operating Cash", status: "pass" },
  //     { label: "Diversification", status: "pass" },
  //     { label: "Gaming Revenue", status: "pass" },
  //     { label: "LinkedIn Growth", status: "pass" },
  //     { label: "Dividend History", status: "pass" },
  //     { label: "Debt Management", status: "pass" },
  //     { label: "Global Reach", status: "pass" },
  //     { label: "Regulatory Hurdles", status: "fail" },
  //     { label: "Talent Retention", status: "pass" },
  //     { label: "Cloud Security", status: "pass" },
  //     { label: "Enterprise Trust", status: "pass" }
  //   ],
  //   chartData: [390, 395, 402, 408, 412, 410, 414, 415],
  //   priceHistory: [
  //     { date: 'Jan', price: 380 },
  //     { date: 'Feb', price: 395 },
  //     { date: 'Mar', price: 405 },
  //     { date: 'Apr', price: 415 },
  //     { date: 'May', price: 410 },
  //     { date: 'Jun', price: 425 },
  //   ]
  // }
];

function AppContent() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  const [theme, setTheme] = useState(() =>
    typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') || 'light' : 'light'
  );

  // Apply theme to root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const [visibleSections, setVisibleSections] = useState({
    header: true,
    health: true,
    chart: true
  });

  const toggleSection = (section) => {
    setVisibleSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const [drawerConfig, setDrawerConfig] = useState({
    isOpen: false,
    title: '',
    children: null,
    width: '450px'
  });

  const openDrawer = (title, content, width = '450px') => {
    setDrawerConfig({
      isOpen: true,
      title,
      children: content,
      width
    });
  };

  const closeDrawer = () => {
    setDrawerConfig(prev => ({ ...prev, isOpen: false }));
  };

  const WatchlistContent = () => (
    <div className="watchlist-table-wrapper">
      <table className="watchlist-table">
        <thead>
          <tr>
            <th>Asset</th>
            <th>Health</th>
            <th>Currency</th>
            <th>Price</th>
            <th>Signal</th>
            <th>Intrinsic</th>
            <th>Support</th>
            <th>Notes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {[
            { ticker: 'NVDA', name: 'NVIDIA Corp', health: 82, curr: 'USD', price: '822.46', signal: 'Buy', intrinsic: '850.00', support: '780.00', notes: 'AI growth looks strong' },
            { ticker: 'AAPL', name: 'Apple Inc', health: 75, curr: 'USD', price: '175.24', signal: 'Hold', intrinsic: '185.00', support: '170.00', notes: 'Waiting for WWDC' },
            { ticker: 'MSFT', name: 'Microsoft', health: 90, curr: 'USD', price: '415.50', signal: 'Buy', intrinsic: '440.00', support: '400.00', notes: 'Azure momentum' },
            { ticker: 'TSLA', name: 'Tesla Inc', health: 65, curr: 'USD', price: '193.57', signal: 'Hold', intrinsic: '180.00', support: '175.00', notes: 'Margin pressure' },
          ].map(stock => (
            <tr key={stock.ticker}>
              <td>
                <div className="watchlist-ticker">{stock.ticker}</div>
                <div className="watchlist-company">{stock.name}</div>
              </td>
              <td>
                <span style={{ color: stock.health > 80 ? 'var(--neu-success)' : 'var(--neu-text-secondary)', fontWeight: 700 }}>
                  {stock.health}
                </span>
              </td>
              <td style={{ color: 'var(--neu-text-tertiary)' }}>{stock.curr}</td>
              <td style={{ fontWeight: 600 }}>${stock.price}</td>
              <td>
                <span className={`watchlist-signal ${stock.signal.toLowerCase()}`}>
                  {stock.signal}
                </span>
              </td>
              <td style={{ color: 'var(--neu-text-secondary)' }}>${stock.intrinsic}</td>
              <td style={{ color: 'var(--neu-text-secondary)' }}>${stock.support}</td>
              <td>
                <input
                  type="text"
                  className="watchlist-notes-input"
                  defaultValue={stock.notes}
                  placeholder="Add notes..."
                />
              </td>
              <td>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                  <Button onClick={() => console.log('Edit', stock.ticker)} style={{ padding: '0.4rem' }}>
                    <Edit2 size={12} />
                  </Button>
                  <Button onClick={() => console.log('Remove', stock.ticker)} style={{ padding: '0.4rem', color: 'var(--neu-error)' }}>
                    <Trash2 size={12} />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const UserDetailsContent = () => (
    <div className="user-details-card">
      <div className="user-profile-header">
        <div className="user-avatar-container">
          <User size={40} />
        </div>
        <div className="user-info">
          <h3>Jianxun Lee</h3>
          <p>Premium Account • Member since 2023</p>
        </div>
      </div>
      <div className="user-actions-row">
        <Button onClick={() => console.log('Settings')} aria-label="Settings">
          <Settings size={20} />
        </Button>
        <Button onClick={() => console.log('Logout')} style={{ color: 'var(--neu-error)' }} aria-label="Logout">
          <LogOut size={20} />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="app" style={{ background: 'var(--neu-app-bg)', minHeight: '100vh', transition: 'background 0.4s ease' }}>
      {loading && <LoadingScreen message="Fabricating Experience..." />}
      <GlobalFilters />

      <header className="demo-section" style={{ justifyContent: 'flex-end', padding: '0 2rem' }}>
        <Menu
          orientation="horizontal"
          placement="bottom-right"
          variant="transparent"
        >
          <Button onClick={() => console.log('Portfolio')} aria-label="Portfolio">
            <Briefcase size={20} />
          </Button>

          <Button onClick={() => openDrawer('Watchlist', <WatchlistContent />, '900px')} aria-label="Watchlist">
            <List size={20} />
          </Button>

          <Button onClick={() => openDrawer('User Details', <UserDetailsContent />, '400px')} aria-label="User Details">
            <User size={20} />
          </Button>

          <Button onClick={toggleTheme} aria-label="Toggle Theme">
            {theme === 'light' ? (
              <Moon size={20} className="neumorphic-icon" style={{ fill: 'var(--neu-text-secondary)' }} />
            ) : (
              <Sun size={20} className="neumorphic-icon" style={{ fill: 'var(--neu-color-favorite)' }} />
            )}
          </Button>

          <Button onClick={() => console.log('Logout')} style={{ color: 'var(--neu-error)' }} aria-label="Logout">
            <LogOut size={20} />
          </Button>
        </Menu>
      </header>

      <main className="demo-section" style={{ flexDirection: 'column', gap: '3rem' }}>
        <h1>Analysis & Health</h1>

        {stocks.map((stock) => (
          <div key={stock.ticker} className="stock-analysis-row">
            <StockHeader
              ticker={stock.ticker}
              name={stock.name}
              price={stock.price}
              change={stock.change}
              changePercent={stock.changePercent}
              onAddToPortfolio={() => console.log(`Added ${stock.ticker}`)}
            />

            <StockHealthCard
              score={stock.healthScore}
              items={stock.healthItems}
              type="Fundamental Health"
            />

            <PriceChartCard
              data={stock.priceHistory}
              title="Price History"
              currentPrice={parseFloat(stock.price)}
            />
          </div>
        ))}

        <h1>Unified Analysis Card</h1>
        <div className="stock-analysis-row">
          <ExpandableCard
            defaultExpanded={true}
            collapsedWidth={Object.values(visibleSections).filter(Boolean).length >= 2 ? 210 : 210}
            collapsedHeight={210}
            headerContent={
              <div className={`stock-summary-container ${Object.values(visibleSections).filter(Boolean).length > 1 ? 'stacked' : ''}`}>
                {visibleSections.header && (
                  <StockHeader
                    view="summary"
                    name={stocks[0].name}
                    ticker={stocks[0].ticker}
                    price={stocks[0].price}
                    change={stocks[0].change}
                    changePercent={stocks[0].changePercent}
                  />
                )}
                {visibleSections.health && (
                  <StockHealthCard
                    view="summary"
                    score={stocks[0].healthScore}
                  />
                )}
                {visibleSections.chart && (
                  <PriceChartCard
                    view="summary"
                    data={stocks[0].priceHistory}
                    change={stocks[0].change}
                  />
                )}
              </div>
            }

            controls={
              <Menu
                orientation="horizontal"
                placement="bottom-right"
                trigger={
                  <Button variant="icon" className="edit-trigger-btn">
                    <Edit2 size={18} />
                  </Button>
                }
              >
                <Button
                  className={visibleSections.header ? 'active' : ''}
                  onClick={() => toggleSection('header')}
                  aria-label="Toggle Details"
                >
                  <Briefcase size={16} />
                </Button>
                <Button
                  className={visibleSections.health ? 'active' : ''}
                  onClick={() => toggleSection('health')}
                  aria-label="Toggle Health"
                >
                  <Zap size={16} />
                </Button>
                <Button
                  className={visibleSections.chart ? 'active' : ''}
                  onClick={() => toggleSection('chart')}
                  aria-label="Toggle Chart"
                >
                  <TrendingUp size={16} />
                </Button>
              </Menu>
            }
          >
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr', /* Rigid single column */
              gap: '2.5rem',
              width: '100%'
            }}>
              {/* Slot 1: Stock Header */}
              {visibleSections.header && (
                <div style={{ width: '100%' }}>
                  <StockHeader
                    ticker={stocks[0].ticker}
                    name={stocks[0].name}
                    price={stocks[0].price}
                    change={stocks[0].change}
                    changePercent={stocks[0].changePercent}
                    variant="transparent"
                  />
                </div>
              )}

              {/* Slot 2: Health Analysis */}
              {visibleSections.health && (
                <div style={{ width: '100%' }}>
                  <StockHealthCard
                    score={stocks[0].healthScore}
                    items={stocks[0].healthItems}
                    type="Fundamental Health"
                    variant="transparent"
                  />
                </div>
              )}

              {/* Slot 3: Price Chart */}
              {visibleSections.chart && (
                <div style={{ width: '100%' }}>
                  <PriceChartCard
                    data={stocks[0].priceHistory}
                    title="Price Performance"
                    currentPrice={parseFloat(stocks[0].price)}
                    variant="transparent"
                  />
                </div>
              )}
            </div>
          </ExpandableCard>
        </div>

        <h1>Market Comparison</h1>
        <div className="stock-analysis-row">
          <TableChart
            title="Holdings"
            columns={[
              { key: 'ticker', label: 'Ticker', type: 'text', width: '80px' },
              { key: 'category', label: 'Category', type: 'text', width: '120px' },
              { key: 'price', label: 'Price', type: 'number', width: '100px' },
              { key: 'beta', label: 'Beta', type: 'number', width: '80px' },
              { key: 'costBasis', label: 'Cost Basis', type: 'number', width: '100px' },
              { key: 'costBasisDate', label: 'Cost Date', type: 'text', width: '120px' },
              { key: 'totalValue', label: 'Total Value', type: 'number', width: '120px' },
              { key: 'changePercent', label: 'Return', type: 'trend', width: '100px' },
              { key: 'fiveYearGrowth', label: '5Y Growth', type: 'trend', width: '100px' },
              {
                key: 'actions',
                label: 'Actions',
                type: 'custom',
                width: '100px',
                render: (_, row) => (
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                    <Button variant="icon" onClick={() => console.log('Edit', row.ticker)} title="Edit">
                      <Edit2 size={14} />
                    </Button>
                    <Button variant="icon" onClick={() => console.log('Delete', row.ticker)} title="Delete" style={{ color: 'var(--neu-error)' }}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                )
              }
            ]}
            data={stocks}
          />
        </div>

        <h1>Sector Performance</h1>
        <div className="stock-analysis-row">
          <VerticalBarChart
            title="Sector Weights"
            data={[
              { name: 'Technology', value: 45 },
              { name: 'Communication', value: 15 },
              { name: 'Cons. Disc.', value: 12 },
              { name: 'Financials', value: 8 },
              { name: 'Energy', value: -2.5 },
              { name: 'Healthcare', value: 10 },
              { name: 'Real Estate', value: 4 },
              { name: 'Utilities', value: 3.5 }
            ]}
            xAxisKey="name"
            dataKey="value"
            barColor="var(--neu-color-favorite)"
          />
        </div>

        <h1>Portfolio Distribution</h1>
        <div className="stock-analysis-row">
          <PortfolioDistribution
            data={[
              { name: 'NVIDIA Corp', ticker: 'NVDA', value: 12336.90, change: 1.90, color: '#6366f1' },
              { name: 'Apple Inc', ticker: 'AAPL', value: 8450.20, change: -0.45, color: '#10b981' },
              { name: 'Microsoft', ticker: 'MSFT', value: 18697.50, change: 0.68, color: '#fbbf24' },
              { name: 'Tesla Inc', ticker: 'TSLA', value: 5807.10, change: -2.08, color: '#ef4444' },
              { name: 'Alphabet Inc', ticker: 'GOOGL', value: 4200.00, change: 1.25, color: '#8b5cf6' },
              { name: 'Amazon.com', ticker: 'AMZN', value: 3150.40, change: 0.85, color: '#ec4899' },
            ]}
          />
        </div>

        <h1>Financial Statements</h1>
        <div className="stock-analysis-row">
          <FinancialStatementsTable />
        </div>

      </main>

      <SideDrawer
        isOpen={drawerConfig.isOpen}
        onClose={closeDrawer}
        title={drawerConfig.title}
        width={drawerConfig.width}
      >
        {drawerConfig.children}
      </SideDrawer>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
