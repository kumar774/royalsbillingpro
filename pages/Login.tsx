import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, limit, query } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import AuthLayout from '../layouts/AuthLayout';
import { Loader2, Mail, Lock, ArrowRight, UserPlus } from 'lucide-react';
import { toast } from 'react-hot-toast';

const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!email || !password) {
      toast.error("Please enter both email and password.");
      setLoading(false);
      return;
    }

    try {
      let user;
      
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        user = userCredential.user;
        toast.success("Welcome back!");
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        user = userCredential.user;
        toast.success("Account created successfully!");
      }

      // Check/Create User Profile
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      let userData = userDoc.exists() ? userDoc.data() : null;

      // If user document doesn't exist (New Sign up or First Login fix)
      if (!userData) {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, limit(1));
        const snapshot = await getDocs(q);
        const isSystemEmpty = snapshot.empty;

        const role = isSystemEmpty ? 'admin' : 'customer';
        const restaurantId = isSystemEmpty ? 'resto-001' : null;

        userData = {
          email: user.email,
          role: role,
          uid: user.uid,
          createdAt: new Date().toISOString(),
          ...(restaurantId && { restaurantId })
        };

        await setDoc(userDocRef, userData);

        if (role === 'admin' && restaurantId) {
          const restaurantRef = doc(db, 'restaurants', restaurantId);
          const restaurantDoc = await getDoc(restaurantRef);
          
          if (!restaurantDoc.exists()) {
             await setDoc(restaurantRef, {
               id: restaurantId,
               name: "My New Restaurant",
               slug: "my-new-restaurant",
               cuisine: ["General"],
               rating: 5.0,
               deliveryTime: "30-45 mins",
               bannerImage: "https://picsum.photos/seed/banner/1200/400",
               logo: "https://picsum.photos/seed/restaurant/100/100",
               location: "New York, USA"
             });
          }
        }
      }

      // Routing
      if (userData?.role === 'admin' && userData.restaurantId) {
        navigate(`/dashboard/${userData.restaurantId}`);
      } else {
        navigate('/');
      }

    } catch (err) {
      console.error("Auth Error:", err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        toast.error("Invalid email or password.");
      } else if (err.code === 'auth/email-already-in-use') {
        toast.error("Email already in use. Please login.");
      } else {
        toast.error(err.message || "Authentication failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-gray-900">
            {isLogin ? 'Sign In to Portal' : 'Create Account'}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {isLogin ? 'Enter your credentials to access.' : 'Join us to order or manage restaurants.'}
          </p>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email address
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </div>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500 sm:text-sm placeholder-gray-400 transition-colors"
              placeholder="you@example.com"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </div>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500 sm:text-sm placeholder-gray-400 transition-colors"
              placeholder="••••••••"
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
            ) : isLogin ? (
              <>Sign in <ArrowRight className="ml-2 h-4 w-4" /></>
            ) : (
              <>Create Account <UserPlus className="ml-2 h-4 w-4" /></>
            )}
          </button>
        </div>

        <div className="text-center mt-4">
          <button
            type="button"
            onClick={() => { setIsLogin(!isLogin); }}
            className="text-sm font-medium text-orange-600 hover:text-orange-500"
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
};

export default Login;