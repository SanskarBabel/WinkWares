// supabase/functions/create-payment-intent/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.11.0?target=deno'

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
    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

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
    const { cart_items, shipping_details } = await req.json()

    if (!cart_items || !Array.isArray(cart_items) || cart_items.length === 0) {
      throw new Error('Cart is empty')
    }

    if (!shipping_details || !shipping_details.email || !shipping_details.name) {
      throw new Error('Shipping details are required')
    }

    // Calculate total from database prices (never trust client)
    let calculatedTotal = 0
    const itemDetails = []

    for (const item of cart_items) {
      // Fetch current product price from database
      const { data: product, error: productError } = await supabaseClient
        .from('products')
        .select('id, title, price_cents, stock_quantity, status')
        .eq('id', item.product_id)
        .single()

      if (productError || !product) {
        throw new Error(`Product not found: ${item.product_id}`)
      }

      // Verify product is available
      if (product.status !== 'active') {
        throw new Error(`Product is not available: ${product.title}`)
      }

      // Verify stock
      if (product.stock_quantity < item.quantity) {
        throw new Error(
          `Insufficient stock for ${product.title}. Available: ${product.stock_quantity}, Requested: ${item.quantity}`
        )
      }

      // Use database price, not client price
      const itemTotal = product.price_cents * item.quantity
      calculatedTotal += itemTotal

      itemDetails.push({
        product_id: product.id,
        title: product.title,
        quantity: item.quantity,
        price_cents: product.price_cents,
        total_cents: itemTotal,
      })
    }

    // Add shipping and tax (simplified - in production, calculate properly)
    const shippingCents = shipping_details.shipping_cents || 0
    const taxCents = shipping_details.tax_cents || 0
    const totalCents = calculatedTotal + shippingCents + taxCents

    // Minimum Stripe amount is $0.50
    if (totalCents < 50) {
      throw new Error('Order total must be at least $0.50')
    }

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        user_id: user.id,
        user_email: user.email || shipping_details.email,
        item_count: cart_items.length,
        subtotal_cents: calculatedTotal.toString(),
        shipping_cents: shippingCents.toString(),
        tax_cents: taxCents.toString(),
      },
      description: `Order from ${shipping_details.name}`,
      receipt_email: shipping_details.email,
    })

    // Return client secret
    return new Response(
      JSON.stringify({
        success: true,
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
        amount: totalCents,
        items: itemDetails,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error creating payment intent:', error)
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