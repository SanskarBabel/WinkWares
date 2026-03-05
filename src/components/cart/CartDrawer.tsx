import { useCart } from '../../contexts/CartContext';
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

export function CartDrawer() {
    const { items, itemCount, totalCents, updateQuantity, removeItem, isOpen, closeCart } = useCart()
    const navigate = useNavigate()

    // Prevent body scroll when drawer is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'unset'
        }
        return () => {
            document.body.style.overflow = 'unset'
        }
    }, [isOpen])

    // Close on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                closeCart()
            }
        }
        window.addEventListener('keydown', handleEscape)
        return () => window.removeEventListener('keydown', handleEscape)
    }, [isOpen, closeCart])

    const handleCheckout = () => {
        closeCart()
        navigate('/checkout')
    }

    if (!isOpen) return null

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-black/50 transition-opacity"
                onClick={closeCart}
            />

            {/* Drawer */}
            <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                    <div className="flex items-center gap-2">
                        <ShoppingBag className="h-5 w-5 text-gray-700" />
                        <h2 className="text-lg font-semibold text-gray-900">
                            Shopping Cart ({itemCount})
                        </h2>
                    </div>
                    <button
                        onClick={closeCart}
                        className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <ShoppingBag className="h-16 w-16 text-gray-300 mb-4" />
                            <p className="text-lg font-medium text-gray-900 mb-1">Your cart is empty</p>
                            <p className="text-sm text-gray-600">Add some products to get started</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {items.map((item) => (
                                <div key={item.product_id} className="flex gap-4 border-b border-gray-200 pb-4">
                                    {/* Product Image */}
                                    <div className="flex-shrink-0 w-20 h-20 bg-gray-100 rounded-lg overflow-hidden">
                                        {item.image_url ? (
                                            <img
                                                src={item.image_url}
                                                alt={item.title}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <ShoppingBag className="h-8 w-8 text-gray-300" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Product Details */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-medium text-gray-900 truncate">
                                            {item.title}
                                        </h3>
                                        {item.vendor_name && (
                                            <p className="text-xs text-gray-500 mt-0.5">by {item.vendor_name}</p>
                                        )}
                                        <p className="text-sm font-semibold text-gray-900 mt-1">
                                            ${(item.price_cents / 100).toFixed(2)}
                                        </p>

                                        {/* Quantity Controls */}
                                        <div className="flex items-center gap-2 mt-2">
                                            <button
                                                onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                                                className="p-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                disabled={item.quantity <= 1}
                                            >
                                                <Minus className="h-3 w-3 text-gray-600" />
                                            </button>
                                            <span className="text-sm font-medium text-gray-900 w-8 text-center">
                                                {item.quantity}
                                            </span>
                                            <button
                                                onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                                                className="p-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                disabled={item.max_quantity ? item.quantity >= item.max_quantity : false}
                                            >
                                                <Plus className="h-3 w-3 text-gray-600" />
                                            </button>
                                            <button
                                                onClick={() => removeItem(item.product_id)}
                                                className="ml-auto p-1 rounded text-red-600 hover:bg-red-50"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {items.length > 0 && (
                    <div className="border-t border-gray-200 px-6 py-4 space-y-4">
                        {/* Subtotal */}
                        <div className="flex items-center justify-between text-base">
                            <span className="text-gray-600">Subtotal</span>
                            <span className="font-semibold text-gray-900">
                                ${(totalCents / 100).toFixed(2)}
                            </span>
                        </div>

                        <p className="text-xs text-gray-500">
                            Shipping and taxes calculated at checkout
                        </p>

                        {/* Checkout Button */}
                        <button
                            onClick={handleCheckout}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3 text-base font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
                        >
                            Proceed to Checkout
                            <ArrowRight className="h-4 w-4" />
                        </button>

                        <button
                            onClick={closeCart}
                            className="w-full px-6 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                        >
                            Continue Shopping
                        </button>
                    </div>
                )}
            </div>
        </>
    )
}