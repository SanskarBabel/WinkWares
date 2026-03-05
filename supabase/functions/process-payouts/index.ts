import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.11.0?target=deno'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VendorPayout {
    vendor_id: string
    vendor_store_name: string
    stripe_connect_id: string
    total_amount_cents: number
    payout_count: number
    payout_ids: string[]
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

        // Create Supabase client with service role
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Verify admin authorization
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error('Missing authorization header')
        }

        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

        if (authError || !user) {
            throw new Error('Invalid authorization token')
        }

        // Check if user is admin
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profileError || profile.role !== 'admin') {
            throw new Error('Unauthorized: Admin access required')
        }

        console.log(`Starting payout processing by admin: ${user.id}`)

        // Create batch record
        const batchNumber = `BATCH-${Date.now()}`
        const { data: batch, error: batchError } = await supabaseClient
            .from('payout_batches')
            .insert({
                batch_number: batchNumber,
                status: 'processing',
            })
            .select()
            .single()

        if (batchError || !batch) {
            throw new Error('Failed to create batch record')
        }

        console.log(`Created batch: ${batchNumber}`)

        // Get all ready payouts grouped by vendor
        const { data: vendorPayouts, error: payoutsError } = await supabaseClient
            .rpc('get_ready_payouts_by_vendor')

        if (payoutsError) {
            throw new Error(`Failed to fetch payouts: ${payoutsError.message}`)
        }

        if (!vendorPayouts || vendorPayouts.length === 0) {
            // No payouts to process
            await supabaseClient
                .from('payout_batches')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                    total_payouts: 0,
                })
                .eq('id', batch.id)

            return new Response(
                JSON.stringify({
                    success: true,
                    message: 'No payouts ready for processing',
                    batch_number: batchNumber,
                    processed: 0,
                }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200,
                }
            )
        }

        console.log(`Processing ${vendorPayouts.length} vendor payouts`)

        let totalProcessed = 0
        let successfulPayouts = 0
        let failedPayouts = 0
        const errors: any[] = []

        // Process each vendor's payout
        for (const vendorPayout of vendorPayouts as VendorPayout[]) {
            try {
                console.log(`Processing payout for vendor ${vendorPayout.vendor_id}: $${vendorPayout.total_amount_cents / 100}`)

                // Check if Stripe Connect ID exists
                if (!vendorPayout.stripe_connect_id) {
                    throw new Error(`Vendor ${vendorPayout.vendor_id} has no Stripe Connect account`)
                }

                // Check minimum payout amount (Stripe minimum is $1)
                if (vendorPayout.total_amount_cents < 100) {
                    throw new Error(`Amount too small: $${vendorPayout.total_amount_cents / 100} (minimum $1)`)
                }

                // Mark payouts as processing
                await supabaseClient
                    .from('payout_queue')
                    .update({ status: 'processing' })
                    .in('id', vendorPayout.payout_ids)

                // Check for existing transfer (idempotency)
                const transferGroup = `${batch.batch_number}-${vendorPayout.vendor_id}`

                const existingTransfers = await stripe.transfers.list({
                    transfer_group: transferGroup,
                    limit: 1,
                })

                if (existingTransfers.data.length > 0) {
                    console.log(`Transfer already exists for vendor ${vendorPayout.vendor_id}`)
                    const existingTransfer = existingTransfers.data[0]

                    // Mark as paid
                    await supabaseClient
                        .from('payout_queue')
                        .update({
                            status: 'paid',
                            processed_at: new Date().toISOString(),
                            stripe_transfer_id: existingTransfer.id,
                            stripe_transfer_group: transferGroup,
                        })
                        .in('id', vendorPayout.payout_ids)

                    // Record transaction
                    await supabaseClient
                        .from('payout_transactions')
                        .insert(
                            vendorPayout.payout_ids.map(payoutId => ({
                                payout_queue_id: payoutId,
                                vendor_id: vendorPayout.vendor_id,
                                batch_id: batch.id,
                                amount_cents: Math.floor(vendorPayout.total_amount_cents / vendorPayout.payout_ids.length),
                                stripe_transfer_id: existingTransfer.id,
                                stripe_destination_account: vendorPayout.stripe_connect_id,
                                status: 'succeeded',
                                initiated_at: new Date().toISOString(),
                                completed_at: new Date().toISOString(),
                            }))
                        )

                    successfulPayouts += vendorPayout.payout_count
                    totalProcessed += vendorPayout.payout_count
                    continue
                }

                // Create Stripe Transfer
                console.log(`Creating Stripe transfer for ${vendorPayout.stripe_connect_id}`)

                const transfer = await stripe.transfers.create({
                    amount: vendorPayout.total_amount_cents,
                    currency: 'usd',
                    destination: vendorPayout.stripe_connect_id,
                    transfer_group: transferGroup,
                    description: `Payout for ${vendorPayout.vendor_store_name} - ${vendorPayout.payout_count} orders`,
                    metadata: {
                        vendor_id: vendorPayout.vendor_id,
                        batch_number: batchNumber,
                        payout_count: vendorPayout.payout_count.toString(),
                    },
                })

                console.log(`Transfer created: ${transfer.id}`)

                // Update payout queue records
                await supabaseClient
                    .from('payout_queue')
                    .update({
                        status: 'paid',
                        processed_at: new Date().toISOString(),
                        stripe_transfer_id: transfer.id,
                        stripe_transfer_group: transferGroup,
                    })
                    .in('id', vendorPayout.payout_ids)

                // Create transaction records
                await supabaseClient
                    .from('payout_transactions')
                    .insert(
                        vendorPayout.payout_ids.map(payoutId => ({
                            payout_queue_id: payoutId,
                            vendor_id: vendorPayout.vendor_id,
                            batch_id: batch.id,
                            amount_cents: Math.floor(vendorPayout.total_amount_cents / vendorPayout.payout_ids.length),
                            stripe_transfer_id: transfer.id,
                            stripe_destination_account: vendorPayout.stripe_connect_id,
                            status: 'succeeded',
                            initiated_at: new Date().toISOString(),
                            completed_at: new Date().toISOString(),
                        }))
                    )

                successfulPayouts += vendorPayout.payout_count
                totalProcessed += vendorPayout.payout_count

            } catch (error) {
                console.error(`Error processing vendor ${vendorPayout.vendor_id}:`, error)

                // Mark payouts as failed
                const failureReason = error instanceof Error ? error.message : 'Unknown error'

                await supabaseClient
                    .from('payout_queue')
                    .update({
                        status: 'failed',
                        failure_reason: failureReason,
                        retry_count: supabaseClient.raw('retry_count + 1'),
                    })
                    .in('id', vendorPayout.payout_ids)

                // Create failed transaction records
                await supabaseClient
                    .from('payout_transactions')
                    .insert(
                        vendorPayout.payout_ids.map(payoutId => ({
                            payout_queue_id: payoutId,
                            vendor_id: vendorPayout.vendor_id,
                            batch_id: batch.id,
                            amount_cents: Math.floor(vendorPayout.total_amount_cents / vendorPayout.payout_ids.length),
                            stripe_transfer_id: 'FAILED',
                            stripe_destination_account: vendorPayout.stripe_connect_id || 'N/A',
                            status: 'failed',
                            error_message: failureReason,
                            initiated_at: new Date().toISOString(),
                        }))
                    )

                failedPayouts += vendorPayout.payout_count
                totalProcessed += vendorPayout.payout_count

                errors.push({
                    vendor_id: vendorPayout.vendor_id,
                    vendor_store_name: vendorPayout.vendor_store_name,
                    error: failureReason,
                })
            }
        }

        // Update batch with final statistics
        await supabaseClient
            .from('payout_batches')
            .update({
                status: failedPayouts > 0 ? 'partial_failure' : 'completed',
                total_payouts: totalProcessed,
                successful_payouts: successfulPayouts,
                failed_payouts: failedPayouts,
                total_amount_cents: vendorPayouts.reduce((sum: number, vp: any) => sum + vp.total_amount_cents, 0),
                completed_at: new Date().toISOString(),
                errors: errors.length > 0 ? errors : null,
            })
            .eq('id', batch.id)

        console.log(`Batch ${batchNumber} completed: ${successfulPayouts} successful, ${failedPayouts} failed`)

        // Return summary
        return new Response(
            JSON.stringify({
                success: true,
                batch_number: batchNumber,
                total_processed: totalProcessed,
                successful: successfulPayouts,
                failed: failedPayouts,
                errors: errors.length > 0 ? errors : null,
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )

    } catch (error) {
        console.error('Fatal error in payout processing:', error)
        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
            }
        )
    }
})