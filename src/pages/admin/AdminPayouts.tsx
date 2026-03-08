import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import { Play, RefreshCw, DollarSign, Users, AlertCircle, CheckCircle } from 'lucide-react'

type ReadyPayout = {
  vendor_id: string
  vendor_store_name: string
  stripe_connect_id: string | null
  total_amount_cents: number
  payout_count: number
  payout_ids: string[]
}

type PayoutBatch = {
  id: string
  batch_number: string
  status: string
  total_payouts: number
  successful_payouts: number
  failed_payouts: number
  total_amount_cents: number
  started_at: string
  completed_at: string | null
  errors: any[] | null
}

export function AdminPayouts() {
  const [readyPayouts, setReadyPayouts] = useState<ReadyPayout[]>([])
  const [recentBatches, setRecentBatches] = useState<PayoutBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadPayoutData()
  }, [])

  const loadPayoutData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load ready payouts
      const { data: payoutsData, error: payoutsError } = await supabase
        .rpc('get_ready_payouts_by_vendor')

      if (payoutsError) throw payoutsError
      setReadyPayouts(payoutsData || [])

      // Load recent batches
      const { data: batchesData, error: batchesError } = await supabase
        .from('payout_batches')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(10)

      if (batchesError) throw batchesError
      setRecentBatches(batchesData || [])
    } catch (err) {
      console.error('Error loading payout data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleProcessPayouts = async () => {
    if (!confirm('Process all ready payouts? This will initiate Stripe transfers.')) {
      return
    }

    setProcessing(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-payouts`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to process payouts')
      }

      alert(
        `Batch processed successfully!\n\n` +
        `Total: ${result.total_processed}\n` +
        `Successful: ${result.successful}\n` +
        `Failed: ${result.failed}`
      )

      // Reload data
      await loadPayoutData()
    } catch (err) {
      console.error('Error processing payouts:', err)
      setError(err instanceof Error ? err.message : 'Failed to process payouts')
    } finally {
      setProcessing(false)
    }
  }

  const totalReadyAmount = readyPayouts.reduce((sum, p) => sum + p.total_amount_cents, 0)
  const totalReadyCount = readyPayouts.reduce((sum, p) => sum + p.payout_count, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payout Processing</h1>
          <p className="text-sm text-gray-600 mt-1">Manage vendor payouts and batch processing</p>
        </div>
        <button
          onClick={loadPayoutData}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-sm text-gray-600">Vendors Ready</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{readyPayouts.length}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-50 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-sm text-gray-600">Total Amount</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ${(totalReadyAmount / 100).toFixed(2)}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-50 rounded-lg">
              <CheckCircle className="h-5 w-5 text-purple-600" />
            </div>
            <p className="text-sm text-gray-600">Total Orders</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalReadyCount}</p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800">{error}</div>
          </div>
        </div>
      )}

      {/* Ready Payouts */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Ready for Processing</h2>
          {readyPayouts.length > 0 && (
            <button
              onClick={handleProcessPayouts}
              disabled={processing}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className={`h-4 w-4 ${processing ? 'animate-pulse' : ''}`} />
              {processing ? 'Processing...' : 'Process All Payouts'}
            </button>
          )}
        </div>

        {readyPayouts.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-600">No payouts ready for processing</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Vendor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Orders
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Stripe Account
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {readyPayouts.map((payout) => (
                  <tr key={payout.vendor_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {payout.vendor_store_name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-gray-900">
                        ${(payout.total_amount_cents / 100).toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{payout.payout_count}</div>
                    </td>
                    <td className="px-6 py-4">
                      {payout.stripe_connect_id ? (
                        <div className="text-xs font-mono text-gray-600 truncate max-w-xs">
                          {payout.stripe_connect_id}
                        </div>
                      ) : (
                        <span className="text-xs text-red-600">Not connected</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Batches */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Batches</h2>
        </div>

        {recentBatches.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-600">No batch history yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Batch Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Success/Failed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentBatches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-mono text-gray-900">{batch.batch_number}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${batch.status === 'completed'
                            ? 'bg-green-50 text-green-700'
                            : batch.status === 'partial_failure'
                              ? 'bg-yellow-50 text-yellow-700'
                              : 'bg-blue-50 text-blue-700'
                          }`}
                      >
                        {batch.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-gray-900">
                        ${(batch.total_amount_cents / 100).toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        <span className="text-green-600">{batch.successful_payouts}</span>
                        {' / '}
                        <span className="text-red-600">{batch.failed_payouts}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {new Date(batch.started_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}