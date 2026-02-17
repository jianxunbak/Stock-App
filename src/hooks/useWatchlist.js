import { useWatchlistContext } from '../context/WatchlistContext';

export const useWatchlist = () => {
    const context = useWatchlistContext();

    return {
        watchlist: context.watchlist,
        loading: context.loading,
        addToWatchlist: context.addToWatchlist,
        removeFromWatchlist: context.removeFromWatchlist,
        updateWatchlistItem: context.updateWatchlistItem,
        setFullWatchlist: context.setFullWatchlist
    };
};
