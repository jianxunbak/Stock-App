import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Star, Plus, Info } from 'lucide-react';
import StyledCard from '../StyledCard';
import Button from '../Button';
import './StockHeader.css';

const StockHeader = ({
    ticker = "AAPL",
    name = "Apple Inc.",
    price = "182.52",
    change = "+1.25",
    changePercent = "0.68%",
    onAddToWatchlist,
    onAddToPortfolio,
    onViewDetails,
    className = "",
    scrollAnimated = false,
    variant = 'default',
    view = 'expanded',
    ...props
}) => {
    const isPositive = change?.startsWith('+');
    const [isFavorite, setIsFavorite] = useState(false);

    const handleFavoriteToggle = () => {
        setIsFavorite(!isFavorite);
        if (onAddToWatchlist) onAddToWatchlist(!isFavorite);
    };

    if (view === 'summary') {
        const shortName = name.split(' ')[0].replace(/[,.]/g, '');

        return (
            <div className="summary-info stock-header-summary">
                <div className="summary-identity-group">
                    {name && <div className="summary-name">{shortName}</div>}
                    {ticker && <div className="summary-ticker">{ticker}</div>}
                </div>
                <div className="summary-price-group">
                    {price && <div className={`summary-price ${isPositive ? 'positive' : 'negative'}`}>${price}</div>}
                    {change && (
                        <div className={`summary-change ${isPositive ? 'positive' : 'negative'}`}>
                            {change} ({changePercent})
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const renderButtons = () => (
        <>
            <Button onClick={onViewDetails} aria-label="View Details">
                <Info
                    className="neumorphic-icon"
                    style={{
                        stroke: 'var(--neu-text-metallic-start)',
                        filter: 'var(--neu-filter-icon-default)',
                        transition: 'all 0.3s ease'
                    }}
                />
            </Button>

            <Button onClick={handleFavoriteToggle} aria-label="Add to Watchlist">
                <Star
                    className="neumorphic-icon"
                    style={{
                        fill: isFavorite ? 'var(--neu-color-favorite)' : 'transparent',
                        stroke: isFavorite ? 'var(--neu-color-favorite)' : 'var(--neu-text-metallic-start)',
                        filter: isFavorite ? 'none' : 'var(--neu-filter-icon-default)',
                        animation: isFavorite ? 'none' : undefined,
                        transition: 'all 0.3s ease'
                    }}
                />
            </Button>

            <Button onClick={onAddToPortfolio} aria-label="Add to Portfolio">
                <Plus
                    className="neumorphic-icon"
                    style={{
                        stroke: 'var(--neu-text-metallic-start)',
                        filter: 'var(--neu-filter-icon-default)',
                        transition: 'all 0.3s ease'
                    }}
                />
            </Button>
        </>
    );

    const headerTitle = (
        <div className="stock-info-left">
            <h1 className="stock-company-name">{name}</h1>
            <span className="stock-ticker-text">{ticker}</span>

            <div className="stock-price-row">
                <span className={`current-price ${isPositive ? 'positive' : 'negative'}`}>${price}</span>
                <div className={`price-change-block ${isPositive ? 'positive' : 'negative'}`}>
                    {isPositive ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                    <span>{change} ({changePercent})</span>
                </div>
            </div>
        </div>
    );

    return (
        <StyledCard
            className={`stock-header-container ${className}`}
            title={headerTitle}
            controls={renderButtons()}
            headerAlign="start"
            headerVerticalAlign="flex-start"
            variant={variant}
            {...props}
        />
    );
};

export default StockHeader;
