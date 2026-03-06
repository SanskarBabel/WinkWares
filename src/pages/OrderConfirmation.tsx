import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase-client';
import { CheckCircle, Package, Truck, Mail } from 'lucide-react';

type Order = {
    id: string
    order_number: string
    status: string
    payment_status: string
    total_cents: number
    shipping_name: string
    shipping_email: string
    created_at: string
}

export function OrderConfirmation() {
    const [searchParams] = useSearchParams()
    const orderId = searchParams.get('order_id')
    const [order, setOrder] = useState<Order | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (orderId) {
            loadOrder(orderId)
        } else {
            setError('No order ID provided')
            setLoading(false)
        }
    }, [orderId])

    const loadOrder = async (id: string) => {
        try {
            const { data, error: orderError } = await supabase
                .from('orders')
                .select('*')
                .eq('id', id)
                .single()

            if (orderError) throw orderError

            setOrder(data)

            // Update payment status to paid if needed
            if (data.payment_status === 'pending') {
                await supabase
                    .from('orders')
                    .update({
                        payment_status: 'succeeded',
                        status: 'processing',
                        paid_at: new Date().toISOString(),
                    })
                    .eq('id', id)
            }
        } catch (err) {
            console.error('Error loading order:', err)
            setError('Failed to load order details')
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        )
    }

    if (error || !order) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4">
                <div className="text-center">
                    <p className="text-lg text-gray-900 mb-4">
                        {error || 'Order not found'}
                    </p>
                    <Link
                        to="/"
                        className="text-primary hover:underline"
                    >
                        Return to home
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4">
            <div className="max-w-3xl mx-auto">
                {/* Success Header */}
                <div className="bg-white rounded-lg border border-gray-200 p-8 text-center mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                        <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Order Confirmed!
                    </h1>
                    <p className="text-gray-600 mb-4">
                        Thank you for your purchase, {order.shipping_name}
                    </p>
                    <p className="text-sm text-gray-500">
                        Order #{order.order_number}
                    </p>
                </div>

                {/* Order Details */}
                <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                        Order Details
                    </h2>

                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <Package className="h-5 w-5 text-gray-400 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-gray-900">Order Number</p>
                                <p className="text-sm text-gray-600">{order.order_number}</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-gray-900">Confirmation Email</p>
                                <p className="text-sm text-gray-600">
                                    Sent to {order.shipping_email}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <Truck className="h-5 w-5 text-gray-400 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-gray-900">Delivery Status</p>
                                <p className="text-sm text-gray-600">
                                    {order.status === 'processing' ? 'Processing your order' : 'Preparing shipment'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Order Total */}
                <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                        Order Total
                    </h2>
                    <div className="flex justify-between items-center">
                        <span className="text-gray-600">Total Paid</span>
                        <span className="text-2xl font-bold text-gray-900">
                            ${(order.total_cents / 100).toFixed(2)}
                        </span>
                    </div>
                </div>

                {/* What's Next */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-3">
                        What happens next?
                    </h2>
                    <ol className="space-y-2 text-sm text-gray-700">
                        <li className="flex items-start gap-2">
                            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">
                                1
                            </span>
                            <span>You'll receive a confirmation email with your order details</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">
                                2
                            </span>
                            <span>Our vendors will prepare your items for shipment</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">
                                3
                            </span>
                            <span>You'll receive tracking information once shipped</span>
                        </li>
                    </ol>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <Link
                        to="/"
                        className="flex-1 px-6 py-3 text-center text-base font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
                    >
                        Continue Shopping
                    </Link>
                    <Link
                        to="/orders"
                        className="flex-1 px-6 py-3 text-center text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        View Order History
                    </Link>
                </div>
            </div>
        </div>
    )
}