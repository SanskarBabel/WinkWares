import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export type CartItem = {
    product_id: string
    title: string
    price_cents: number
    quantity: number
    image_url?: string
    vendor_name?: string
    max_quantity?: number
}

type CartContextType = {
    items: CartItem[]
    itemCount: number
    totalCents: number
    addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void
    removeItem: (productId: string) => void
    updateQuantity: (productId: string, quantity: number) => void
    clearCart: () => void
    isOpen: boolean
    openCart: () => void
    closeCart: () => void
}

const CartContext = createContext<CartContextType | undefined>(undefined)

const CART_STORAGE_KEY = 'marketmind_cart'

export function CartProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([])
    const [isOpen, setIsOpen] = useState(false)

    // Load cart from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(CART_STORAGE_KEY)
            if (stored) {
                const parsed = JSON.parse(stored)
                setItems(Array.isArray(parsed) ? parsed : [])
            }
        } catch (error) {
            console.error('Error loading cart from localStorage:', error)
            localStorage.removeItem(CART_STORAGE_KEY)
        }
    }, [])

    // Save cart to localStorage whenever it changes
    useEffect(() => {
        try {
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
        } catch (error) {
            console.error('Error saving cart to localStorage:', error)
        }
    }, [items])

    const addItem = (item: Omit<CartItem, 'quantity'>, quantity: number = 1) => {
        setItems((current) => {
            const existingIndex = current.findIndex((i) => i.product_id === item.product_id)

            if (existingIndex >= 0) {
                // Item exists, update quantity
                const updated = [...current]
                const newQuantity = updated[existingIndex].quantity + quantity

                // Check max quantity if provided
                if (item.max_quantity && newQuantity > item.max_quantity) {
                    updated[existingIndex].quantity = item.max_quantity
                } else {
                    updated[existingIndex].quantity = newQuantity
                }

                return updated
            } else {
                // New item, add to cart
                return [...current, { ...item, quantity }]
            }
        })
    }

    const removeItem = (productId: string) => {
        setItems((current) => current.filter((item) => item.product_id !== productId))
    }

    const updateQuantity = (productId: string, quantity: number) => {
        if (quantity <= 0) {
            removeItem(productId)
            return
        }

        setItems((current) =>
            current.map((item) => {
                if (item.product_id === productId) {
                    // Check max quantity
                    if (item.max_quantity && quantity > item.max_quantity) {
                        return { ...item, quantity: item.max_quantity }
                    }
                    return { ...item, quantity }
                }
                return item
            })
        )
    }

    const clearCart = () => {
        setItems([])
    }

    const openCart = () => setIsOpen(true)
    const closeCart = () => setIsOpen(false)

    // Computed values
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)
    const totalCents = items.reduce((sum, item) => sum + item.price_cents * item.quantity, 0)

    return (
        <CartContext.Provider
            value={{
                items,
                itemCount,
                totalCents,
                addItem,
                removeItem,
                updateQuantity,
                clearCart,
                isOpen,
                openCart,
                closeCart,
            }}
        >
            {children}
        </CartContext.Provider>
    )
}

export function useCart() {
    const context = useContext(CartContext)
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider')
    }
    return context
}