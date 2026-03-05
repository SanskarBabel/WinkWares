import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Component that redirects authenticated users to their role-specific dashboard
 * Used after login/signup to route users to the correct location
 */
export function RedirectHandler() {
    const { profile, loading } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    useEffect(() => {
        if (loading) return

        if (profile) {
            // Get the intended destination from location state (if user was redirected to login)
            const from = (location.state as any)?.from?.pathname

            // If there's a specific destination, go there
            // Otherwise, redirect based on role
            if (from && from !== '/login' && from !== '/signup') {
                navigate(from, { replace: true })
                return
            }

            // Default role-based redirects
            switch (profile.role) {
                case 'admin':
                    navigate('/admin', { replace: true })
                    break
                case 'vendor':
                    navigate('/vendor/dashboard', { replace: true })
                    break
                case 'customer':
                    navigate('/', { replace: true })
                    break
                default:
                    navigate('/', { replace: true })
            }
        }
    }, [profile, loading, navigate, location])

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        )
    }

    return null
}