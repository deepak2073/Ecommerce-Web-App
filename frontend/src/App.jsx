import React, { useState, useEffect, createContext, useContext } from 'react';
import { ShoppingCart, User, Package, Star, Plus, Minus, X, LogIn, UserPlus, LogOut, Eye, Trash2 } from 'lucide-react';
// import {SignupModal, LoginModal, CartModal, OrdersModal, Toast, Modal, ProductCard, Header} from  './components';

// Context for global state management
const AppContext = createContext();

const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};

// API service
const API_BASE = 'https://ecommerce-web-app-k6c9.onrender.com/api';

const api = {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: token }),
      ...options.headers,
    };

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Request failed');
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  // Auth endpoints
  signup: (data) => api.request('/users', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => api.request('/users/login', { method: 'POST', body: JSON.stringify(data) }),

  // Items endpoints
  getItems: () => api.request('/items'),
  createItem: (data) => api.request('/items', { method: 'POST', body: JSON.stringify(data) }),

  // Cart endpoints
  getCart: () => api.request('/carts/me'),
  addToCart: (data) => api.request('/carts', { method: 'POST', body: JSON.stringify(data) }),
  removeFromCart: (itemId) => api.request(`/carts/items/${itemId}`, { method: 'DELETE' }),

  // Order endpoints
  createOrder: () => api.request('/orders', { method: 'POST', body: JSON.stringify({}) }),
  getOrders: () => api.request('/orders/me'),
};


const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  
  // Modal states
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showCartModal, setShowCartModal] = useState(false);
  const [showOrdersModal, setShowOrdersModal] = useState(false);

  const showToast = (message, type) => {
    setToast({ message, type });
  };

  const closeToast = () => {
    setToast(null);
  };

  // Check login status on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUsername = localStorage.getItem('username');
    
    if (token && storedUsername) {
      setIsLoggedIn(true);
      setUsername(storedUsername);
    }
    
    loadProducts();
    setLoading(false);
  }, []);

  // Load cart when logged in
  useEffect(() => {
    if (isLoggedIn) {
      loadCart();
      loadOrders();
    }
  }, [isLoggedIn]);

  const loadProducts = async () => {
    try {
      const response = await api.getItems();
      setProducts(response.items || []);
    } catch (error) {
      showToast('Failed to load products', 'error');
    }
  };

  const loadCart = async () => {
    try {
      const response = await api.getCart();
      setCart(response.cart);
    } catch (error) {
      console.error('Failed to load cart:', error);
    }
  };

  const loadOrders = async () => {
    try {
      const response = await api.getOrders();
      setOrders(response.orders || []);
    } catch (error) {
      console.error('Failed to load orders:', error);
    }
  };

  const handleLogin = () => {
    setShowLoginModal(true);
  };

  const handleSignup = () => {
    setShowSignupModal(true);
  };

  const handleLoginSuccess = () => {
    const storedUsername = localStorage.getItem('username');
    setIsLoggedIn(true);
    setUsername(storedUsername);
    setShowLoginModal(false);
  };

  const handleSignupSuccess = () => {
    setShowSignupModal(false);
    setShowLoginModal(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('userId');
    setIsLoggedIn(false);
    setUsername('');
    setCart(null);
    setOrders([]);
    showToast('Logged out successfully', 'success');
  };

  const handleAddToCart = async (itemId, quantity) => {
    try {
      await api.addToCart({ item_id: itemId, quantity });
      loadCart();
      showToast('Item added to cart!', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleRemoveFromCart = async (itemId) => {
    try {
      await api.removeFromCart(itemId);
      loadCart();
      showToast('Item removed from cart', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleCheckout = async () => {
    try {
      await api.createOrder();
      loadCart();
      loadOrders();
      setShowCartModal(false);
      showToast('Order placed successfully!', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const cartItemCount = cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
      type === 'success' ? 'bg-green-500' : 'bg-red-500'
    } text-white`}>
      <div className="flex items-center justify-between">
        <span>{message}</span>
        <button onClick={onClose} className="ml-4">
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

const LoginModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { showToast } = useAppContext();

  const handleSubmit = async () => {
    if (!formData.username || !formData.password) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    setLoading(true);

    try {
      const response = await api.login(formData);
      localStorage.setItem('token', response.token);
      localStorage.setItem('username', response.username);
      localStorage.setItem('userId', response.user_id);
      onSuccess();
      onClose();
      showToast('Login successful!', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Login">
      <div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Username</label>
          <input
            type="text"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Password</label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </div>
    </Modal>
  );
};

const SignupModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { showToast } = useAppContext();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.signup(formData);
      showToast('Account created successfully! Please login.', 'success');
      onClose();
      onSuccess();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sign Up">
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Username</label>
          <input
            type="text"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Email</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Password</label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            minLength="6"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? 'Creating Account...' : 'Sign Up'}
        </button>
      </form>
    </Modal>
  );
};

const ProductCard = ({ product, onAddToCart, isLoggedIn }) => {
  const [quantity, setQuantity] = useState(1);

  const handleAddToCart = () => {
    if (!isLoggedIn) {
      alert('Please login to add items to cart');
      return;
    }
    onAddToCart(product.id, quantity);
    setQuantity(1);
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <img
        src={product.image_url || 'https://via.placeholder.com/300x200'}
        alt={product.name}
        className="w-full h-48 object-cover"
      />
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold text-gray-800">{product.name}</h3>
          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
            {product.category}
          </span>
        </div>
        <p className="text-gray-600 text-sm mb-3">{product.description}</p>
        <div className="flex justify-between items-center mb-4">
          <span className="text-2xl font-bold text-blue-600">${product.price}</span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="p-1 rounded-full bg-gray-200 hover:bg-gray-300"
            >
              <Minus size={16} />
            </button>
            <span className="px-3 py-1 bg-gray-100 rounded">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="p-1 rounded-full bg-gray-200 hover:bg-gray-300"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
        <button
          onClick={handleAddToCart}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
        >
          <ShoppingCart size={16} />
          <span>Add to Cart</span>
        </button>
      </div>
    </div>
  );
};

const CartModal = ({ isOpen, onClose, cart, onRemoveItem, onCheckout }) => {
  const total = cart?.items?.reduce((sum, item) => sum + (item.item.price * item.quantity), 0) || 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Shopping Cart">
      <div className="max-h-96 overflow-y-auto">
        {!cart?.items || cart.items.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Your cart is empty</p>
        ) : (
          <>
            {cart.items.map((item) => (
              <div key={item.id} className="flex items-center space-x-4 py-4 border-b">
                <img
                  src={item.item.image_url || 'https://via.placeholder.com/60x60'}
                  alt={item.item.name}
                  className="w-16 h-16 object-cover rounded"
                />
                <div className="flex-1">
                  <h4 className="font-semibold">{item.item.name}</h4>
                  <p className="text-gray-600">Qty: {item.quantity}</p>
                  <p className="text-blue-600 font-bold">${(item.item.price * item.quantity).toFixed(2)}</p>
                </div>
                <button
                  onClick={() => onRemoveItem(item.item.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <div className="pt-4">
              <div className="flex justify-between items-center mb-4">
                <span className="text-lg font-bold">Total: ${total.toFixed(2)}</span>
              </div>
              <button
                onClick={onCheckout}
                className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700"
              >
                Checkout
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

const OrdersModal = ({ isOpen, onClose, orders }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Your Orders">
      <div className="max-h-96 overflow-y-auto">
        {!orders || orders.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No orders found</p>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="border-b py-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">Order #{order.id}</span>
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                  {order.status}
                </span>
              </div>
              <p className="text-gray-600 text-sm mb-2">
                {new Date(order.created_at).toLocaleDateString()}
              </p>
              <div className="space-y-2">
                {order.items?.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>{item.item.name} x{item.quantity}</span>
                    <span>${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="font-bold text-right mt-2">
                Total: ${order.total.toFixed(2)}
              </div>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
};

const Header = ({ 
  isLoggedIn, 
  username, 
  cartItemCount, 
  onLogin, 
  onSignup, 
  onLogout, 
  onCartClick, 
  onOrdersClick 
}) => {
  return (
    <header className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-2">
            <ShoppingCart className="text-blue-600" size={32} />
            <h1 className="text-2xl font-bold text-gray-800">ShopEase</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {isLoggedIn ? (
              <>
                <span className="text-gray-700">Welcome, {username}!</span>
                <button
                  onClick={onCartClick}
                  className="relative p-2 text-gray-600 hover:text-blue-600"
                >
                  <ShoppingCart size={24} />
                  {cartItemCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {cartItemCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={onOrdersClick}
                  className="p-2 text-gray-600 hover:text-blue-600"
                >
                  <Package size={24} />
                </button>
                <button
                  onClick={onLogout}
                  className="flex items-center space-x-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onLogin}
                  className="flex items-center space-x-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  <LogIn size={16} />
                  <span>Login</span>
                </button>
                <button
                  onClick={onSignup}
                  className="flex items-center space-x-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  <UserPlus size={16} />
                  <span>Sign Up</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    
    <AppContext.Provider value={{ showToast }}>
      <div className="min-h-screen bg-gray-50">
        <Header
          isLoggedIn={isLoggedIn}
          username={username}
          cartItemCount={cartItemCount}
          onLogin={handleLogin}
          onSignup={handleSignup}
          onLogout={handleLogout}
          onCartClick={() => setShowCartModal(true)}
          onOrdersClick={() => setShowOrdersModal(true)}
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">Featured Products</h2>
            <p className="text-gray-600">Discover amazing products at great prices</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={handleAddToCart}
                isLoggedIn={isLoggedIn}
              />
            ))}
          </div>
        </main>

        {/* Modals */}
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onSuccess={handleLoginSuccess}
        />

        <SignupModal
          isOpen={showSignupModal}
          onClose={() => setShowSignupModal(false)}
          onSuccess={handleSignupSuccess}
        />

        <CartModal
          isOpen={showCartModal}
          onClose={() => setShowCartModal(false)}
          cart={cart}
          onRemoveItem={handleRemoveFromCart}
          onCheckout={handleCheckout}
        />

        <OrdersModal
          isOpen={showOrdersModal}
          onClose={() => setShowOrdersModal(false)}
          orders={orders}
        />

        {/* Toast */}
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={closeToast}
          />
        )}
      </div>
    </AppContext.Provider>
  );
};

export default App;
