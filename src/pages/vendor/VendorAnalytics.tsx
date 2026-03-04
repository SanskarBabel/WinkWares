// src/pages/vendor/VendorAnalytics.tsx
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase-client';
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    ShoppingCart,
    Eye,
    Percent,
    Sparkles,
    RefreshCw,
} from 'lucide-react';

type AnalyticsSnapshot = {
    id: string
    snapshot_date: string
    total_orders: number
    total_revenue_cents: number
    total_items_sold: number
    average_order_value_cents: number
    total_page_views: number
    unique_visitors: number
    conversion_rate: number
    sales_by_category: Array<{
        category_name: string
        revenue_cents: number
        quantity: number
    }>
    ai_insight: string | null
    ai_insight_generated_at: string | null
}

type VendorSummary = {
    total_revenue_cents: number
    total_orders: number
    total_items_sold: number
    average_order_value_cents: number
    total_page_views: number
    average_conversion_rate: number
}

export function VendorAnalytics() {
    const [snapshots, setSnapshots] = useState<AnalyticsSnapshot[]>([])
    const [summary, setSummary] = useState<VendorSummary | null>(null)
    const [vendorId, setVendorId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [generatingInsight, setGeneratingInsight] = useState(false)
    const [insightError, setInsightError] = useState<string | null>(null)

    useEffect(() => {
        loadAnalytics()
    }, [])

    const loadAnalytics = async () => {
        try {
            setLoading(true)

            // Get vendor ID
            const { data: vendor, error: vendorError } = await supabase
                .from('vendors')
                .select('id')
                .single()

            if (vendorError) throw vendorError
            setVendorId(vendor.id)

            // Get last 30 days of snapshots
            const thirtyDaysAgo = new Date()
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

            const { data: snapshotsData, error: snapshotsError } = await supabase
                .from('analytics_snapshots')
                .select('*')
                .eq('vendor_id', vendor.id)
                .gte('snapshot_date', thirtyDaysAgo.toISOString().split('T')[0])
                .order('snapshot_date', { ascending: true })

            if (snapshotsError) throw snapshotsError
            setSnapshots(snapshotsData || [])

            // Get overall summary using the helper function
            const { data: summaryData, error: summaryError } = await supabase
                .rpc('get_vendor_performance_summary', { p_vendor_id: vendor.id })

            if (summaryError) throw summaryError
            if (summaryData && summaryData.length > 0) {
                setSummary(summaryData[0])
            }
        } catch (error) {
            console.error('Error loading analytics:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleGenerateInsight = async () => {
        if (!vendorId) return

        setGeneratingInsight(true)
        setInsightError(null)

        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) throw new Error('Not authenticated')

            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-insight`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ vendor_id: vendorId }),
                }
            )

            const result = await response.json()

            if (!result.success) {
                throw new Error(result.error || 'Failed to generate insight')
            }

            // Reload analytics to get updated insight
            await loadAnalytics()
        } catch (error) {
            console.error('Error generating insight:', error)
            setInsightError(error instanceof Error ? error.message : 'Failed to generate insight')
        } finally {
            setGeneratingInsight(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        )
    }

    // Prepare chart data
    const revenueChartData = snapshots.map((s) => ({
        date: new Date(s.snapshot_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: s.total_revenue_cents / 100,
        orders: s.total_orders,
    }))

    // Aggregate category data
    const categoryMap = new Map<string, { revenue: number, quantity: number }>()
    snapshots.forEach((snapshot) => {
        if (snapshot.sales_by_category && Array.isArray(snapshot.sales_by_category)) {
            snapshot.sales_by_category.forEach((cat) => {
                const existing = categoryMap.get(cat.category_name) || { revenue: 0, quantity: 0 }
                categoryMap.set(cat.category_name, {
                    revenue: existing.revenue + cat.revenue_cents,
                    quantity: existing.quantity + cat.quantity,
                })
            })
        }
    })

    const categoryChartData = Array.from(categoryMap.entries())
        .map(([name, stats]) => ({
            category: name,
            revenue: stats.revenue / 100,
            quantity: stats.quantity,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5) // Top 5 categories

    // Calculate trend
    const firstWeek = snapshots.slice(0, 7)
    const lastWeek = snapshots.slice(-7)
    const firstWeekRevenue = firstWeek.reduce((sum, s) => sum + s.total_revenue_cents, 0)
    const lastWeekRevenue = lastWeek.reduce((sum, s) => sum + s.total_revenue_cents, 0)
    const revenueTrend = firstWeekRevenue > 0
        ? ((lastWeekRevenue - firstWeekRevenue) / firstWeekRevenue) * 100
        : 0

    // Get latest AI insight
    const latestInsight = snapshots
        .filter((s) => s.ai_insight)
        .sort((a, b) => new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime())[0]

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
                <p className="text-sm text-gray-600 mt-1">Track your store's performance</p>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    icon={DollarSign}
                    label="Total Revenue"
                    value={`$${((summary?.total_revenue_cents || 0) / 100).toFixed(2)}`}
                    trend={revenueTrend}
                    iconColor="text-green-600"
                    bgColor="bg-green-50"
                />
                <MetricCard
                    icon={ShoppingCart}
                    label="Total Orders"
                    value={(summary?.total_orders || 0).toString()}
                    iconColor="text-blue-600"
                    bgColor="bg-blue-50"
                />
                <MetricCard
                    icon={Eye}
                    label="Total Views"
                    value={(summary?.total_page_views || 0).toLocaleString()}
                    iconColor="text-purple-600"
                    bgColor="bg-purple-50"
                />
                <MetricCard
                    icon={Percent}
                    label="Avg Conversion"
                    value={`${(summary?.average_conversion_rate || 0).toFixed(2)}%`}
                    iconColor="text-orange-600"
                    bgColor="bg-orange-50"
                />
            </div>

            {/* AI Insight Card */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Sparkles className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">AI-Powered Insight</h2>
                            <p className="text-xs text-gray-600">
                                {latestInsight?.ai_insight_generated_at
                                    ? `Generated ${new Date(latestInsight.ai_insight_generated_at).toLocaleDateString()}`
                                    : 'No insights yet'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleGenerateInsight}
                        disabled={generatingInsight || snapshots.length === 0}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-white border border-blue-300 rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <RefreshCw className={`h-4 w-4 ${generatingInsight ? 'animate-spin' : ''}`} />
                        {generatingInsight ? 'Generating...' : 'Refresh'}
                    </button>
                </div>

                {insightError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-800">{insightError}</p>
                    </div>
                )}

                <div className="bg-white rounded-lg p-4 border border-blue-100">
                    {latestInsight?.ai_insight ? (
                        <p className="text-gray-800 leading-relaxed">{latestInsight.ai_insight}</p>
                    ) : (
                        <p className="text-gray-500 italic">
                            {snapshots.length === 0
                                ? 'No analytics data available yet. Come back after some sales activity.'
                                : 'Click "Refresh" to generate AI-powered insights based on your sales data.'}
                        </p>
                    )}
                </div>
            </div>

            {/* Revenue Chart */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend (Last 30 Days)</h2>
                {revenueChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={revenueChartData}>
                            <defs>
                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis
                                dataKey="date"
                                stroke="#6b7280"
                                fontSize={12}
                                tickLine={false}
                            />
                            <YAxis
                                stroke="#6b7280"
                                fontSize={12}
                                tickLine={false}
                                tickFormatter={(value) => `$${value}`}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'white',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                }}
                                formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
                            />
                            <Area
                                type="monotone"
                                dataKey="revenue"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorRevenue)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-64 flex items-center justify-center text-gray-500">
                        No revenue data available
                    </div>
                )}
            </div>

            {/* Sales by Category */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Sales by Category</h2>
                {categoryChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={categoryChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis
                                dataKey="category"
                                stroke="#6b7280"
                                fontSize={12}
                                tickLine={false}
                            />
                            <YAxis
                                stroke="#6b7280"
                                fontSize={12}
                                tickLine={false}
                                tickFormatter={(value) => `$${value}`}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'white',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                }}
                                formatter={(value: number, name: string) => [
                                    name === 'revenue' ? `$${value.toFixed(2)}` : value,
                                    name === 'revenue' ? 'Revenue' : 'Quantity',
                                ]}
                            />
                            <Legend />
                            <Bar dataKey="revenue" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                            <Bar dataKey="quantity" fill="#10b981" radius={[8, 8, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-64 flex items-center justify-center text-gray-500">
                        No category data available
                    </div>
                )}
            </div>

            {/* Additional Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <p className="text-sm text-gray-600 mb-1">Average Order Value</p>
                    <p className="text-2xl font-bold text-gray-900">
                        ${((summary?.average_order_value_cents || 0) / 100).toFixed(2)}
                    </p>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <p className="text-sm text-gray-600 mb-1">Total Items Sold</p>
                    <p className="text-2xl font-bold text-gray-900">
                        {(summary?.total_items_sold || 0).toLocaleString()}
                    </p>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <p className="text-sm text-gray-600 mb-1">Revenue Trend</p>
                    <div className="flex items-center gap-2">
                        <p className="text-2xl font-bold text-gray-900">
                            {revenueTrend > 0 ? '+' : ''}
                            {revenueTrend.toFixed(1)}%
                        </p>
                        {revenueTrend >= 0 ? (
                            <TrendingUp className="h-5 w-5 text-green-600" />
                        ) : (
                            <TrendingDown className="h-5 w-5 text-red-600" />
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// Metric Card Component
function MetricCard({
    icon: Icon,
    label,
    value,
    trend,
    iconColor,
    bgColor,
}: {
    icon: any
    label: string
    value: string
    trend?: number
    iconColor: string
    bgColor: string
}) {
    return (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
                <div className={`p-2 ${bgColor} rounded-lg`}>
                    <Icon className={`h-5 w-5 ${iconColor}`} />
                </div>
                {trend !== undefined && (
                    <div className="flex items-center gap-1">
                        {trend >= 0 ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                        <span
                            className={`text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}
                        >
                            {trend > 0 ? '+' : ''}
                            {trend.toFixed(1)}%
                        </span>
                    </div>
                )}
            </div>
            <p className="text-sm text-gray-600 mb-1">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
    )
}