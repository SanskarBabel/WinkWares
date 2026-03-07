import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadStripe } from '@stripe/stripe-js'
import {
    Elements,
    PaymentElement,
    useStripe,
    useElements,
} from '@stripe/react-stripe-js'
import { useCart } from '../contexts/CartContext'
import { supabase } from '../lib/supabase-client'
import { ShoppingBag, Lock, AlertCircle } from 'lucide-react'

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

export function CheckoutPage() {
    const { items, totalCents } = useCart()
    const navigate = useNavigate()
    const [clientSecret, setClientSecret] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [shippingDetails, setShippingDetails] = useState({
        name: '',
        email: '',
        phone: '',
        address: {
            line1: '',
            line2: '',
            city: '',
            state: '',
            postal_code: '',
            country: 'US',
        },
    })

    // Redirect if cart is empty
    useEffect(() => {
        if (items.length === 0) {
            navigate('/')
        }
    }, [items, navigate])

    const handleCreatePaymentIntent = async () => {
        try {
            setError(null)

            // Validate shipping details
            if (!shippingDetails.name || !shippingDetails.email || !shippingDetails.address.line1) {
                setError('Please fill in all required shipping details')
                return
            }

            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                setError('Please log in to continue')
                return
            }

            // Create payment intent
            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-intent`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        cart_items: items.map(item => ({
                            product_id: item.product_id,
                            quantity: item.quantity,
                        })),
                        shipping_details: {
                            ...shippingDetails,
                            shipping_cents: 0, // Calculate based on your shipping logic
                            tax_cents: Math.round(totalCents * 0.08), // 8% tax example
                        },
                    }),
                }
            )

            const result = await response.json()

            if (!result.success) {
                throw new Error(result.error || 'Failed to create payment intent')
            }

            setClientSecret(result.client_secret)
        } catch (err) {
            console.error('Error creating payment intent:', err)
            setError(err instanceof Error ? err.message : 'An error occurred')
        }
    }

    if (items.length === 0) {
        return null
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-6xl mx-auto px-4">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
                    <p className="text-sm text-gray-600 mt-1">Complete your purchase</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column - Shipping & Payment */}
                    <div className="space-y-6">
                        {/* Shipping Information */}
                        <div className="bg-white rounded-lg border border-gray-200 p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">
                                Shipping Information
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Full Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={shippingDetails.name}
                                        onChange={(e) =>
                                            setShippingDetails({ ...shippingDetails, name: e.target.value })
                                        }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                        placeholder="John Doe"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Email *
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        value={shippingDetails.email}
                                        onChange={(e) =>
                                            setShippingDetails({ ...shippingDetails, email: e.target.value })
                                        }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                        placeholder="john@example.com"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Phone
                                    </label>
                                    <input
                                        type="tel"
                                        value={shippingDetails.phone}
                                        onChange={(e) =>
                                            setShippingDetails({ ...shippingDetails, phone: e.target.value })
                                        }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                        placeholder="+1 (555) 000-0000"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Address Line 1 *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={shippingDetails.address.line1}
                                        onChange={(e) =>
                                            setShippingDetails({
                                                ...shippingDetails,
                                                address: { ...shippingDetails.address, line1: e.target.value },
                                            })
                                        }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                        placeholder="123 Main St"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Address Line 2
                                    </label>
                                    <input
                                        type="text"
                                        value={shippingDetails.address.line2}
                                        onChange={(e) =>
                                            setShippingDetails({
                                                ...shippingDetails,
                                                address: { ...shippingDetails.address, line2: e.target.value },
                                            })
                                        }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                        placeholder="Apt 4B"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            City *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={shippingDetails.address.city}
                                            onChange={(e) =>
                                                setShippingDetails({
                                                    ...shippingDetails,
                                                    address: { ...shippingDetails.address, city: e.target.value },
                                                })
                                            }
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                            placeholder="New York"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            State *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={shippingDetails.address.state}
                                            onChange={(e) =>
                                                setShippingDetails({
                                                    ...shippingDetails,
                                                    address: { ...shippingDetails.address, state: e.target.value },
                                                })
                                            }
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                            placeholder="NY"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        ZIP Code *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={shippingDetails.address.postal_code}
                                        onChange={(e) =>
                                            setShippingDetails({
                                                ...shippingDetails,
                                                address: { ...shippingDetails.address, postal_code: e.target.value },
                                            })
                                        }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                        placeholder="10001"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Payment Section */}
                        {!clientSecret ? (
                            <div className="bg-white rounded-lg border border-gray-200 p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <Lock className="h-5 w-5 text-gray-600" />
                                    <h2 className="text-lg font-semibold text-gray-900">Payment</h2>
                                </div>

                                {error && (
                                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                                        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                                        <p className="text-sm text-red-800">{error}</p>
                                    </div>
                                )}

                                <button
                                    onClick={handleCreatePaymentIntent}
                                    className="w-full px-6 py-3 text-base font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
                                >
                                    Continue to Payment
                                </button>
                            </div>
                        ) : (
                            <div className="bg-white rounded-lg border border-gray-200 p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <Lock className="h-5 w-5 text-gray-600" />
                                    <h2 className="text-lg font-semibold text-gray-900">Payment Details</h2>
                                </div>

                                <Elements stripe={stripePromise} options={{ clientSecret }}>
                                    <CheckoutForm
                                        clientSecret={clientSecret}
                                        shippingDetails={shippingDetails}
                                    />
                                </Elements>
                            </div>
                        )}
                    </div>

                    {/* Right Column - Order Summary */}
                    <div>
                        <div className="bg-white rounded-lg border border-gray-200 p-6 sticky top-8">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>

                            <div className="space-y-4 mb-6">
                                {items.map((item) => (
                                    <div key={item.product_id} className="flex gap-3">
                                        <div className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-lg overflow-hidden">
                                            {item.image_url ? (
                                                <img
                                                    src={item.image_url}
                                                    alt={item.title}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <ShoppingBag className="h-6 w-6 text-gray-300" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">
                                                {item.title}
                                            </p>
                                            <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                                            <p className="text-sm font-semibold text-gray-900 mt-1">
                                                ${((item.price_cents * item.quantity) / 100).toFixed(2)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="border-t border-gray-200 pt-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Subtotal</span>
                                    <span className="text-gray-900">${(totalCents / 100).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Shipping</span>
                                    <span className="text-gray-900">FREE</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Tax (8%)</span>
                                    <span className="text-gray-900">
                                        ${((totalCents * 0.08) / 100).toFixed(2)}
                                    </span>
                                </div>
                                <div className="border-t border-gray-200 pt-2 flex justify-between">
                                    <span className="text-base font-semibold text-gray-900">Total</span>
                                    <span className="text-base font-bold text-gray-900">
                                        ${((totalCents * 1.08) / 100).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Checkout Form Component (wrapped in Elements)
function CheckoutForm({
    clientSecret,
    shippingDetails,
}: {
    clientSecret: string
    shippingDetails: any
}) {
    const stripe = useStripe()
    const elements = useElements()
    const navigate = useNavigate()
    const { items, clearCart } = useCart()
    const [processing, setProcessing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!stripe || !elements) {
            return
        }

        setProcessing(true)
        setError(null)

        try {
            // Create order in database first
            const { data: orderResult, error: orderError } = await supabase.rpc('create_order', {
                p_cart_items: items.map(item => ({
                    product_id: item.product_id,
                    quantity: item.quantity,
                })),
                p_shipping_details: {
                    name: shippingDetails.name,
                    email: shippingDetails.email,
                    phone: shippingDetails.phone,
                    address: shippingDetails.address,
                    shipping_cents: 0,
                    tax_cents: Math.round(items.reduce((sum, item) => sum + item.price_cents * item.quantity, 0) * 0.08),
                },
            })

            if (orderError || !orderResult || orderResult[0]?.insufficient_stock) {
                throw new Error(
                    orderResult?.[0]?.insufficient_stock
                        ? 'Some items are out of stock'
                        : 'Failed to create order'
                )
            }

            const orderId = orderResult[0].order_id

            // Confirm payment with Stripe
            const { error: stripeError } = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: `${window.location.origin}/order-confirmation?order_id=${orderId}`,
                },
            })

            if (stripeError) {
                throw new Error(stripeError.message)
            }

            // Clear cart on success
            clearCart()
        } catch (err) {
            console.error('Payment error:', err)
            setError(err instanceof Error ? err.message : 'Payment failed')
            setProcessing(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <PaymentElement />

            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800">{error}</p>
                </div>
            )}

            <button
                type="submit"
                disabled={!stripe || processing}
                className="w-full px-6 py-3 text-base font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {processing ? 'Processing...' : 'Complete Order'}
            </button>

            <p className="text-xs text-gray-500 text-center">
                Your payment is secured by Stripe. We never store your card details.
            </p>
        </form>
    )
}