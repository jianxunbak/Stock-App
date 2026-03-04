import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from './ui/LoadingScreen/LoadingScreen';

const ProtectedRoute = ({ children }) => {
    const { currentUser, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && !currentUser) {
            navigate('/', { replace: true });
        }
    }, [currentUser, loading, navigate]);

    if (loading) {
        return <LoadingScreen fullScreen={true} />;
    }

    if (!currentUser) {
        return null;
    }

    return children;
};

export default ProtectedRoute;
