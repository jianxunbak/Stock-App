import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Star, Plus, Info } from 'lucide-react';
import StyledCard from '../StyledCard';
import Button from '../Button';
import './StockHeader.css';


const StockHeader = ({
    ticker = "AAPL",
    name = "Apple Inc.",
    price = "0.00",
    change = "0.00",
    changePercent = "0.00%",
    onAddToWatchlist,
    onAddToPortfolio,
    onViewDetails,
    className = "",
    scrollAnimated = false,
    variant = 'default',
    view = 'expanded',
    isFavorite: initialIsFavorite = false,
    currencySymbol = "$",
    currentRate = 1,
    showFavorite = true,
    hideChange = false,
    ...props
}) => {
    // Robust parsing for price and change
    const numPrice = typeof price === 'string' ? parseFloat(price.replace(/[^0-9.-]+/g, "")) : price;
    const numChange = typeof change === 'string' ? parseFloat(change.replace(/[^0-9.-]+/g, "")) : change;
    const numChangePercent = typeof changePercent === 'string' ? parseFloat(changePercent.replace(/[^0-9.-]+/g, "")) : changePercent;

    const isPositive = numChange >= 0;
    const displayPrice = (numPrice * currentRate).toFixed(2);
    const displayChange = (isPositive ? "+" : "") + (numChange * currentRate).toFixed(2);
    const displayChangePercent = (isPositive ? "+" : "") + numChangePercent.toFixed(2) + "%";

    const [isFavorite, setIsFavorite] = useState(initialIsFavorite);

    useEffect(() => {
        setIsFavorite(initialIsFavorite);
    }, [initialIsFavorite]);

    const handleFavoriteToggle = () => {
        const newState = !isFavorite;
        setIsFavorite(newState);
        if (onAddToWatchlist) onAddToWatchlist(newState);
    };

    if (view === 'summary') {
        const shortName = name.split(' ')[0].replace(/[,.]/g, '');

        return (
            <div className="summary-info stock-header-summary">
                <div className="summary-identity-group" style={{ position: 'relative' }}>
                    {name && <div className="summary-name">{shortName}</div>}
                    {ticker && <div className="summary-ticker">{ticker}</div>}
                </div>
                <div className="summary-price-group">
                    {price && <div className={`summary-price ${isPositive ? 'positive' : 'negative'}`}>{currencySymbol}{displayPrice}</div>}
                    {!hideChange && change && (
                        <div className={`summary-change ${isPositive ? 'positive' : 'negative'}`}>
                            {currencySymbol}{displayChange} ({displayChangePercent})
                        </div>
                    )}
                </div>
            </div>
        );
    }




    const headerTitle = (
        <div className="stock-info-left">
            {(name || showFavorite) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                    {name && <h1 className="stock-company-name" style={{ margin: 0 }}>{name}</h1>}
                    {showFavorite && (
                        <Button
                            variant="icon"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleFavoriteToggle();
                            }}
                            style={{ padding: 0 }}
                        >
                            <Star
                                size={20}
                                className="neumorphic-icon"
                                style={{
                                    fill: isFavorite ? 'var(--neu-color-favorite)' : 'transparent',
                                    stroke: isFavorite ? 'var(--neu-color-favorite)' : 'var(--neu-text-metallic-start)',
                                    filter: isFavorite ? 'none' : 'var(--neu-filter-icon-default)',
                                    transition: 'all 0.3s ease'
                                }}
                            />
                        </Button>
                    )}
                </div>
            )}
            {ticker && <span className="stock-ticker-text">{ticker}</span>}

            <div className="stock-price-row">
                <span className={`current-price ${isPositive ? 'positive' : 'negative'}`}>{currencySymbol}{displayPrice}</span>
                {!hideChange && (
                    <div className={`price-change-block ${isPositive ? 'positive' : 'negative'}`}>
                        {isPositive ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                        <span>{currencySymbol}{displayChange} ({displayChangePercent})</span>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <StyledCard
            className={`stock-header-container ${className}`}
            title={headerTitle}
            headerAlign="start"
            headerVerticalAlign="flex-start"
            variant={variant}
            {...props}
        />
    );
};

export default StockHeader;
