import { ShoppingCart } from 'lucide-react';

export function VendorOrders() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
                <p className="text-sm text-gray-600 mt-1">Manage and track your orders</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Orders Coming Soon
                </h3>
                <p className="text-sm text-gray-600 max-w-md mx-auto">
                    Order management functionality will be available once you start receiving orders.
                    Set up your products first to begin accepting orders.
                </p>
            </div>
        </div>
    )
}