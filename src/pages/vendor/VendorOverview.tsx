import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase-client'
import { DollarSign, Package, ShoppingCart, TrendingUp, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

type Stats = {
    totalProducts: number
    activeProducts: number
    totalOrders: number
    totalRevenue: number
}

type Vendor = {
    store_name: string
    onboarding_status: string
}

export function VendorOverview() {
    const [stats, setStats] = useState<Stats>({
        totalProducts: 0,
        activeProducts: 0,
        totalOrders: 0,
        totalRevenue: 0,
    })
    const [vendor, setVendor] = useState<Vendor | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadDashboardData()
    }, [])

    const loadDashboardData = async () => {
        try {
            // Load vendor info
            const { data: vendorData, error: vendorError } = await supabase
                .from('vendors')
                .select('store_name, onboarding_status')
                .single()

            if (vendorError) throw vendorError
            setVendor(vendorData)

            // Load products stats
            const { data: products, error: productsError } = await supabase
                .from('products')
                .select('status, price_cents')

            if (productsError) throw productsError

            const totalProducts = products?.length || 0
            const activeProducts = products?.filter((p: { status: string }) => p.status === 'active').length || 0

            setStats({
                totalProducts,
                activeProducts,
                totalOrders: 0, // Will be implemented with orders table
                totalRevenue: 0, // Will be calculated from orders
            })
        } catch (error) {
            console.error('Error loading dashboard data:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Welcome Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">
                    Welcome back, {vendor?.store_name || 'Vendor'}!
                </h1>
                <p className="text-sm text-gray-600 mt-1">Here's what's happening with your store today</p>
            </div>

            {/* Verification Alert */}
            {vendor?.onboarding_status !== 'verified' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex gap-3">
                        <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-medium text-yellow-900">
                                Complete Your Verification
                            </p>
                            <p className="text-sm text-yellow-700 mt-1">
                                Your account is pending verification. Upload your documents to start selling.
                            </p>
                            <Link
                                to="/vendor/settings"
                                className="inline-block mt-2 text-sm font-medium text-yellow-900 hover:underline"
                            >
                                Complete verification →
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <Package className="h-6 w-6 text-blue-600" />
                        </div>
                        <span className="text-xs text-gray-500">Total</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalProducts}</p>
                    <p className="text-sm text-gray-600 mt-1">Products</p>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-green-50 rounded-lg">
                            <TrendingUp className="h-6 w-6 text-green-600" />
                        </div>
                        <span className="text-xs text-gray-500">Live</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{stats.activeProducts}</p>
                    <p className="text-sm text-gray-600 mt-1">Active Products</p>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-purple-50 rounded-lg">
                            <ShoppingCart className="h-6 w-6 text-purple-600" />
                        </div>
                        <span className="text-xs text-gray-500">All time</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalOrders}</p>
                    <p className="text-sm text-gray-600 mt-1">Orders</p>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-orange-50 rounded-lg">
                            <DollarSign className="h-6 w-6 text-orange-600" />
                        </div>
                        <span className="text-xs text-gray-500">Revenue</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                        ${(stats.totalRevenue / 100).toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Total Earnings</p>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Link
                        to="/vendor/products"
                        className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
                    >
                        <Package className="h-5 w-5 text-primary" />
                        <div>
                            <p className="text-sm font-medium text-gray-900">Add Product</p>
                            <p className="text-xs text-gray-500">Create a new listing</p>
                        </div>
                    </Link>

                    <Link
                        to="/vendor/orders"
                        className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
                    >
                        <ShoppingCart className="h-5 w-5 text-primary" />
                        <div>
                            <p className="text-sm font-medium text-gray-900">View Orders</p>
                            <p className="text-xs text-gray-500">Manage your orders</p>
                        </div>
                    </Link>

                    <Link
                        to="/vendor/settings"
                        className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
                    >
                        <AlertCircle className="h-5 w-5 text-primary" />
                        <div>
                            <p className="text-sm font-medium text-gray-900">Settings</p>
                            <p className="text-xs text-gray-500">Update your store</p>
                        </div>
                    </Link>
                </div>
            </div>

            {/* Getting Started */}
            {stats.totalProducts === 0 && (
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">
                        🚀 Get Started with Your Store
                    </h2>
                    <p className="text-sm text-gray-700 mb-4">
                        Follow these steps to set up your store and start selling:
                    </p>
                    <div className="space-y-3">
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold">
                                1
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-900">Complete verification</p>
                                <p className="text-xs text-gray-600">Upload your business documents</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold">
                                2
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-900">Add your first product</p>
                                <p className="text-xs text-gray-600">Create detailed product listings</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-6 h-6 bg-gray-300 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                3
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-900">Start selling</p>
                                <p className="text-xs text-gray-600">Share your store and receive orders</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}