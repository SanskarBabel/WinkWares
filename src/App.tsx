// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { CartProvider } from '@/contexts/CartContext'
import { ProtectedRoute, AdminRoute, VendorRoute, CustomerRoute } from '@/components/auth/ProtectedRoute'
import { RedirectHandler } from '@/components/auth/RedirectHandler'
import { VendorLayout } from '@/components/vendor/VendorLayout'
import { VendorOverview } from '@/pages/vendor/VendorOverview'
import { VendorProducts } from '@/pages/vendor/VendorProducts'
import { VendorOrders } from '@/pages/vendor/VendorOrders'
import { VendorAnalytics } from '@/pages/vendor/VendorAnalytics'
import { VendorSettings } from '@/pages/vendor/VendorSettings'
import { VendorPayouts } from '@/pages/vendor/VendorPayouts'
import { CheckoutPage } from '@/pages/CheckoutPage'
import { OrderConfirmation } from '@/pages/OrderConfirmation'
import { CartDrawer } from '@/components/cart/CartDrawer'
import { SupportChat } from '@/components/vendor/SupportChat'
import { ErrorBoundary, RouteErrorBoundary } from '@/components/ErrorBoundary'

// Placeholder components (to be implemented)
function LoginPage() {
  return <div className="flex items-center justify-center min-h-screen">Login Page</div>
}

function SignupPage() {
  return <div className="flex items-center justify-center min-h-screen">Signup Page</div>
}

function HomePage() {
  return <div className="flex items-center justify-center min-h-screen">Customer Home Page</div>
}

function AdminDashboard() {
  return <div className="flex items-center justify-center min-h-screen">Admin Dashboard</div>
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-4xl font-bold text-gray-900 mb-2">404</h1>
      <p className="text-gray-600">Page not found</p>
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />

              {/* Redirect handler for post-authentication */}
              <Route
                path="/auth/callback"
                element={
                  <ProtectedRoute>
                    <RedirectHandler />
                  </ProtectedRoute>
                }
              />

              {/* Customer routes */}
              <Route
                path="/"
                element={
                  <CustomerRoute>
                    <RouteErrorBoundary>
                      <HomePage />
                    </RouteErrorBoundary>
                  </CustomerRoute>
                }
              />

              {/* Checkout routes (authenticated customers) */}
              <Route
                path="/checkout"
                element={
                  <ProtectedRoute>
                    <RouteErrorBoundary>
                      <CheckoutPage />
                    </RouteErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/order-confirmation"
                element={
                  <ProtectedRoute>
                    <RouteErrorBoundary>
                      <OrderConfirmation />
                    </RouteErrorBoundary>
                  </ProtectedRoute>
                }
              />

              {/* Vendor routes with layout */}
              <Route
                path="/vendor"
                element={
                  <VendorRoute>
                    <VendorLayout />
                  </VendorRoute>
                }
              >
                <Route path="dashboard" element={<RouteErrorBoundary><VendorOverview /></RouteErrorBoundary>} />
                <Route path="products" element={<RouteErrorBoundary><VendorProducts /></RouteErrorBoundary>} />
                <Route path="orders" element={<RouteErrorBoundary><VendorOrders /></RouteErrorBoundary>} />
                <Route path="analytics" element={<RouteErrorBoundary><VendorAnalytics /></RouteErrorBoundary>} />
                <Route path="payouts" element={<RouteErrorBoundary><VendorPayouts /></RouteErrorBoundary>} />
                <Route path="settings" element={<RouteErrorBoundary><VendorSettings /></RouteErrorBoundary>} />
              </Route>

              {/* Admin routes */}
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <RouteErrorBoundary>
                      <AdminDashboard />
                    </RouteErrorBoundary>
                  </AdminRoute>
                }
              />

              {/* Catch all - 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>

            {/* Global Cart Drawer */}
            <CartDrawer />
            
            {/* Global Support Chat (vendor routes only) */}
            <VendorSupportChat />
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

// Support chat wrapper that only shows on vendor routes
function VendorSupportChat() {
  const location = window.location.pathname
  const isVendorRoute = location.startsWith('/vendor')
  
  if (!isVendorRoute) return null
  
  return <SupportChat />
}

export default App;