import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const startTime = Date.now()

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
    const { message, vendor_id } = await req.json()

    if (!message || !vendor_id) {
      throw new Error('Missing required parameters: message, vendor_id')
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
      throw new Error('Unauthorized access to vendor')
    }

    console.log(`Processing chat for vendor: ${vendor.store_name}`)

    // ============================================
    // STEP 1: EMBED USER MESSAGE & SEARCH DOCS
    // ============================================

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    // Generate embedding for user message
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: message,
      }),
    })

    if (!embeddingResponse.ok) {
      throw new Error('Failed to generate embedding')
    }

    const embeddingData = await embeddingResponse.json()
    const queryEmbedding = embeddingData.data[0].embedding

    // Search for relevant documentation
    const { data: relevantDocs, error: searchError } = await supabaseClient
      .rpc('search_documentation', {
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: 5,
      })

    if (searchError) {
      console.error('Documentation search error:', searchError)
    }

    console.log(`Found ${relevantDocs?.length || 0} relevant documentation entries`)

    // ============================================
    // STEP 2: FETCH VENDOR'S REAL-TIME DATA
    // ============================================

    // Fetch payout queue summary
    const { data: payoutSummary, error: payoutError } = await supabaseClient
      .rpc('get_vendor_payout_summary', { p_vendor_id: vendor_id })

    if (payoutError) {
      console.error('Payout summary error:', payoutError)
    }

    // Fetch last 7 days of analytics
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: recentAnalytics, error: analyticsError } = await supabaseClient
      .from('analytics_snapshots')
      .select('*')
      .eq('vendor_id', vendor_id)
      .gte('snapshot_date', sevenDaysAgo.toISOString().split('T')[0])
      .order('snapshot_date', { ascending: false })

    if (analyticsError) {
      console.error('Analytics error:', analyticsError)
    }

    // Calculate summary stats
    const totalRevenue = recentAnalytics?.reduce((sum, day) => sum + day.total_revenue_cents, 0) || 0
    const totalOrders = recentAnalytics?.reduce((sum, day) => sum + day.total_orders, 0) || 0
    const avgConversion = recentAnalytics?.length > 0
      ? (recentAnalytics.reduce((sum, day) => sum + day.conversion_rate, 0) / recentAnalytics.length).toFixed(2)
      : 0

    // ============================================
    // STEP 3: CONSTRUCT SYSTEM PROMPT WITH CONTEXT
    // ============================================

    const documentationContext = relevantDocs && relevantDocs.length > 0
      ? relevantDocs.map((doc: any) => 
          `[${doc.title}]\n${doc.content}\n`
        ).join('\n---\n\n')
      : 'No relevant documentation found.'

    const vendorDataContext = `
Vendor: ${vendor.store_name}

PAYOUT STATUS:
- Pending Payouts: $${((payoutSummary?.[0]?.total_pending_cents || 0) / 100).toFixed(2)} (${payoutSummary?.[0]?.pending_count || 0} orders)
- Ready to Pay: $${((payoutSummary?.[0]?.total_ready_cents || 0) / 100).toFixed(2)} (${payoutSummary?.[0]?.ready_count || 0} orders)
- Total Paid: $${((payoutSummary?.[0]?.total_paid_cents || 0) / 100).toFixed(2)} (${payoutSummary?.[0]?.paid_count || 0} payouts)
- Failed Payouts: ${payoutSummary?.[0]?.failed_count || 0}
- Next Payout Date: ${payoutSummary?.[0]?.next_payout_date ? new Date(payoutSummary[0].next_payout_date).toLocaleDateString() : 'N/A'}

RECENT PERFORMANCE (Last 7 Days):
- Total Revenue: $${(totalRevenue / 100).toFixed(2)}
- Total Orders: ${totalOrders}
- Average Conversion Rate: ${avgConversion}%
`.trim()

    const systemPrompt = `You are MarketMind Support, an AI assistant helping vendors on the MarketMind marketplace platform.

INSTRUCTIONS:
- Answer questions using the provided documentation and vendor's real-time data
- Be helpful, professional, and concise
- If the documentation doesn't contain the answer, acknowledge this and provide general guidance
- Use specific numbers from the vendor's data when relevant
- Format monetary amounts with currency symbols
- If asked about payouts, reference their actual payout status
- If asked about performance, reference their actual analytics

AVAILABLE DOCUMENTATION:
${documentationContext}

VENDOR'S CURRENT DATA:
${vendorDataContext}

Remember: Provide accurate, helpful responses based on the context above. If you're unsure, say so.`

    // ============================================
    // STEP 4: CALL OPENAI WITH STREAMING
    // ============================================

    const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 1000,
        stream: true,
      }),
    })

    if (!chatResponse.ok) {
      throw new Error('Failed to get chat response')
    }

    // Store user message in history (non-blocking)
    const contextDocs = relevantDocs?.map((doc: any) => doc.id) || []
    
    supabaseClient
      .from('chat_history')
      .insert({
        vendor_id,
        message,
        role: 'user',
        context_docs: contextDocs,
        vendor_data: {
          payouts: payoutSummary?.[0] || null,
          analytics: recentAnalytics || null,
        },
      })
      .then(() => console.log('User message stored'))
      .catch(err => console.error('Failed to store user message:', err))

    // Create readable stream for response
    const stream = new ReadableStream({
      async start(controller) {
        const reader = chatResponse.body?.getReader()
        const decoder = new TextDecoder()
        let fullResponse = ''
        let tokenCount = 0

        try {
          while (true) {
            const { done, value } = await reader!.read()
            if (done) break

            const chunk = decoder.decode(value)
            const lines = chunk.split('\n').filter(line => line.trim() !== '')

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') continue

                try {
                  const parsed = JSON.parse(data)
                  const content = parsed.choices[0]?.delta?.content || ''
                  
                  if (content) {
                    fullResponse += content
                    tokenCount += 1
                    controller.enqueue(new TextEncoder().encode(content))
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }

          // Store assistant response (non-blocking)
          const responseTime = Date.now() - startTime
          
          supabaseClient
            .from('chat_history')
            .insert({
              vendor_id,
              message: fullResponse,
              role: 'assistant',
              context_docs: contextDocs,
              tokens_used: tokenCount,
              response_time_ms: responseTime,
            })
            .then(() => console.log('Assistant response stored'))
            .catch(err => console.error('Failed to store assistant response:', err))

        } catch (error) {
          console.error('Streaming error:', error)
          controller.error(error)
        } finally {
          controller.close()
        }
      },
    })

    // Return streaming response
    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    console.error('Error in vendor chat:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})