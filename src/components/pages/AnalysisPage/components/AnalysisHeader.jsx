import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { TopNavLogo, TopNavActions } from '../../../ui/Navigation/TopNav';
import CascadingHeader from '../../../ui/CascadingHeader/CascadingHeader';
import Button from '../../../ui/Button';

const AnalysisHeader = ({
    ticker,
    setTicker,
    handleSearch,
    currency,
    setCurrency,
    setShowWatchlist,
    setShowProfileModal,
    handleLogout,
    loading
}) => {
    const navigate = useNavigate();

    const actionGroupContent = (
        <TopNavActions
            searchTicker={ticker}
            setSearchTicker={setTicker}
            handleSearch={handleSearch}
            currency={currency}
            setCurrency={setCurrency}
            setShowWatchlist={setShowWatchlist}
            setShowProfileModal={setShowProfileModal}
            handleLogout={handleLogout}
            loading={loading}
        />
    );

    const backButtonContent = !loading && (
        <Button
            onClick={() => navigate('/')}
            variant="icon"
        >
            <ArrowLeft size={20} />
        </Button>
    );

    return (
        <>
            <div style={{ position: 'absolute', top: '20px', left: '0px', zIndex: 80, pointerEvents: 'none' }}>
                <TopNavLogo />
            </div>

            <CascadingHeader
                topRightContent={actionGroupContent}
                bottomLeftContent={backButtonContent}
                gap="40px"
            />
        </>
    );
};

export default React.memo(AnalysisHeader);
