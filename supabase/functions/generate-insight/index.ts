import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AnalyticsData {
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
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Create Supabase client
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Verify authentication
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error('Missing authorization header')
        }

        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

        if (authError || !user) {
            throw new Error('Invalid authorization token')
        }

        // Parse request body
        const { vendor_id } = await req.json()

        if (!vendor_id) {
            throw new Error('Missing vendor_id parameter')
        }

        // Verify user owns this vendor
        const { data: vendor, error: vendorError } = await supabaseClient
            .from('vendors')
            .select('id, profile_id, store_name')
            .eq('id', vendor_id)
            .single()

        if (vendorError || !vendor) {
            throw new Error('Vendor not found')
        }

        if (vendor.profile_id !== user.id) {
            throw new Error('Unauthorized access to vendor analytics')
        }

        console.log(`Generating insights for vendor: ${vendor.store_name} (${vendor_id})`)

        // Fetch last 30 days of analytics data
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const { data: analyticsData, error: analyticsError } = await supabaseClient
            .from('analytics_snapshots')
            .select('*')
            .eq('vendor_id', vendor_id)
            .gte('snapshot_date', thirtyDaysAgo.toISOString().split('T')[0])
            .order('snapshot_date', { ascending: true })

        if (analyticsError) {
            throw new Error(`Failed to fetch analytics: ${analyticsError.message}`)
        }

        if (!analyticsData || analyticsData.length === 0) {
            throw new Error('No analytics data available for the last 30 days')
        }

        // Format data for OpenAI
        const formattedData = formatAnalyticsForAI(analyticsData as AnalyticsData[])

        // Call OpenAI API
        const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
        if (!openaiApiKey) {
            throw new Error('OpenAI API key not configured')
        }

        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `You are a data analyst specializing in e-commerce analytics. Analyze the sales trends and provide ONE strategic, actionable tip to improve business performance. Be concise (2-3 sentences max) and specific. Focus on the most impactful insight from the data.`
                    },
                    {
                        role: 'user',
                        content: `Analyze this 30-day sales data for ${vendor.store_name} and provide one strategic tip:\n\n${formattedData}`
                    }
                ],
                temperature: 0.7,
                max_tokens: 200,
            }),
        })

        if (!openaiResponse.ok) {
            const errorData = await openaiResponse.json()
            throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`)
        }

        const openaiData = await openaiResponse.json()
        const aiInsight = openaiData.choices[0]?.message?.content?.trim()

        if (!aiInsight) {
            throw new Error('No insight generated from OpenAI')
        }

        console.log(`Generated insight: ${aiInsight}`)

        // Update the latest snapshot with AI insight
        const latestSnapshot = analyticsData[analyticsData.length - 1]

        const { error: updateError } = await supabaseClient
            .from('analytics_snapshots')
            .update({
                ai_insight: aiInsight,
                ai_insight_generated_at: new Date().toISOString(),
            })
            .eq('id', latestSnapshot.id)

        if (updateError) {
            console.error('Failed to update snapshot with insight:', updateError)
            // Don't throw - insight was generated successfully
        }

        // Return success
        return new Response(
            JSON.stringify({
                success: true,
                insight: aiInsight,
                snapshot_date: latestSnapshot.snapshot_date,
                data_points: analyticsData.length,
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )

    } catch (error) {
        console.error('Error generating insight:', error)
        return new Response(
            JSON.stringify({
                success: false,
                error: error.message,
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})

// Helper function to format analytics data for AI
function formatAnalyticsForAI(data: AnalyticsData[]): string {
    const totalDays = data.length

    // Calculate trends
    const firstWeek = data.slice(0, 7)
    const lastWeek = data.slice(-7)

    const firstWeekRevenue = firstWeek.reduce((sum, d) => sum + d.total_revenue_cents, 0)
    const lastWeekRevenue = lastWeek.reduce((sum, d) => sum + d.total_revenue_cents, 0)
    const revenueTrend = ((lastWeekRevenue - firstWeekRevenue) / firstWeekRevenue * 100).toFixed(1)

    const avgConversion = (data.reduce((sum, d) => sum + d.conversion_rate, 0) / totalDays).toFixed(2)

    // Total metrics
    const totalRevenue = data.reduce((sum, d) => sum + d.total_revenue_cents, 0)
    const totalOrders = data.reduce((sum, d) => sum + d.total_orders, 0)
    const totalViews = data.reduce((sum, d) => sum + d.total_page_views, 0)

    // Category performance
    const categoryMap = new Map<string, { revenue: number, quantity: number }>()

    data.forEach(day => {
        if (day.sales_by_category && Array.isArray(day.sales_by_category)) {
            day.sales_by_category.forEach((cat: any) => {
                const existing = categoryMap.get(cat.category_name) || { revenue: 0, quantity: 0 }
                categoryMap.set(cat.category_name, {
                    revenue: existing.revenue + cat.revenue_cents,
                    quantity: existing.quantity + cat.quantity,
                })
            })
        }
    })

    const topCategories = Array.from(categoryMap.entries())
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 3)
        .map(([name, stats]) => `${name}: $${(stats.revenue / 100).toFixed(2)} (${stats.quantity} items)`)
        .join(', ')

    return `
Period: Last ${totalDays} days

Overall Performance:
- Total Revenue: $${(totalRevenue / 100).toFixed(2)}
- Total Orders: ${totalOrders}
- Average Order Value: $${(totalRevenue / totalOrders / 100).toFixed(2)}
- Total Page Views: ${totalViews}
- Average Conversion Rate: ${avgConversion}%

Trends:
- Revenue Trend (First Week vs Last Week): ${revenueTrend > 0 ? '+' : ''}${revenueTrend}%

Top Categories:
${topCategories || 'No category data available'}

Daily Revenue Pattern:
${data.slice(-7).map(d =>
        `${d.snapshot_date}: $${(d.total_revenue_cents / 100).toFixed(2)} (${d.total_orders} orders, ${d.conversion_rate}% conversion)`
    ).join('\n')}
  `.trim()
}