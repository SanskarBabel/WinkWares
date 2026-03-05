import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase-client'
import { useCart } from '@/contexts/CartContext'
import { ShoppingCart, Check } from 'lucide-react'

type Product = {
    id: string
    title: string
    description: string
    price_cents: number
    stock_quantity: number
    images: string[]
    vendors?: {
        store_name: string
    }
}

export function ProductPage() {
    const { id } = useParams()
    const { addItem, openCart } = useCart()
    const [product, setProduct] = useState<Product | null>(null)
    const [loading, setLoading] = useState(true)
    const [quantity, setQuantity] = useState(1)
    const [added, setAdded] = useState(false)

    useEffect(() => {
        if (id) {
            loadProduct(id)
        }
    }, [id])

    const loadProduct = async (productId: string) => {
        try {
            const { data, error } = await supabase
                .from('products')
                .select(`
          *,
          vendors (store_name)
        `)
                .eq('id', productId)
                .eq('status', 'active')
                .single()

            if (error) throw error
            setProduct(data)
        } catch (error) {
            console.error('Error loading product:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleAddToCart = () => {
        if (!product) return

        addItem(
            {
                product_id: product.id,
                title: product.title,
                price_cents: product.price_cents,
                image_url: product.images?.[0],
                vendor_name: product.vendors?.store_name,
                max_quantity: product.stock_quantity,
            },
            quantity
        )

        setAdded(true)
        setTimeout(() => setAdded(false), 2000)
    }

    const handleBuyNow = () => {
        handleAddToCart()
        openCart()
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        )
    }

    if (!product) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-gray-600">Product not found</p>
            </div>
        )
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Product Image */}
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                    {product.images?.[0] ? (
                        <img
                            src={product.images[0]}
                            alt={product.title}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <ShoppingCart className="h-24 w-24 text-gray-300" />
                        </div>
                    )}
                </div>

                {/* Product Details */}
                <div className="space-y-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">
                            {product.title}
                        </h1>
                        {product.vendors?.store_name && (
                            <p className="text-sm text-gray-600">
                                by {product.vendors.store_name}
                            </p>
                        )}
                    </div>

                    <div className="text-3xl font-bold text-gray-900">
                        ${(product.price_cents / 100).toFixed(2)}
                    </div>

                    {product.description && (
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 mb-2">
                                Description
                            </h2>
                            <p className="text-gray-700 whitespace-pre-wrap">
                                {product.description}
                            </p>
                        </div>
                    )}

                    <div>
                        <p className="text-sm text-gray-600 mb-2">
                            {product.stock_quantity > 0
                                ? `${product.stock_quantity} in stock`
                                : 'Out of stock'}
                        </p>

                        {product.stock_quantity > 0 && (
                            <div className="flex items-center gap-4 mb-4">
                                <label className="text-sm font-medium text-gray-700">
                                    Quantity:
                                </label>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                        className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50"
                                    >
                                        -
                                    </button>
                                    <span className="w-12 text-center font-medium">
                                        {quantity}
                                    </span>
                                    <button
                                        onClick={() =>
                                            setQuantity(Math.min(product.stock_quantity, quantity + 1))
                                        }
                                        className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={handleAddToCart}
                                disabled={product.stock_quantity === 0}
                                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 text-base font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {added ? (
                                    <>
                                        <Check className="h-5 w-5" />
                                        Added to Cart
                                    </>
                                ) : (
                                    <>
                                        <ShoppingCart className="h-5 w-5" />
                                        Add to Cart
                                    </>
                                )}
                            </button>

                            <button
                                onClick={handleBuyNow}
                                disabled={product.stock_quantity === 0}
                                className="px-6 py-3 text-base font-medium text-primary bg-white border-2 border-primary rounded-lg hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Buy Now
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}