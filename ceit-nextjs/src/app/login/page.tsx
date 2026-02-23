'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();
  const { theme } = useTheme();
  const d = theme === 'dark';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.login({ email, password });
      login(response.data.token, response.data.user);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`flex min-h-screen items-center justify-center px-4 transition-colors duration-300 ${d ? 'bg-black' : 'bg-orange-50'}`}>
      <div className="w-full max-w-md">
        <div className={`backdrop-blur-xl ${d ? 'bg-black/85 border-orange-500/25' : 'bg-white border-orange-200 shadow-xl'} border rounded-2xl p-8 transition-colors duration-300`}>
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-black bg-clip-text text-transparent mb-2">
              CEIT Admin Portal
            </h1>
            <h2 className={`text-2xl font-semibold ${d ? 'text-orange-200' : 'text-orange-700'}`}>
              Login
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className={`block text-sm font-medium mb-2 ${d ? 'text-orange-100' : 'text-orange-900'}`}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all ${
                  d ? 'bg-black/60 border border-orange-500/30 text-white placeholder-orange-200/60' : 'bg-white border border-orange-200 text-black placeholder-orange-400/70'
                }`}
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${d ? 'text-orange-100' : 'text-orange-900'}`}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all ${
                  d ? 'bg-black/60 border border-orange-500/30 text-white placeholder-orange-200/60' : 'bg-white border border-orange-200 text-black placeholder-orange-400/70'
                }`}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className={`px-4 py-3 rounded-xl text-center ${d ? 'bg-red-500/15 border border-red-500/50 text-red-100' : 'bg-red-50 border border-red-300 text-red-700'}`}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-200 disabled:text-orange-600 text-white font-medium rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:transform-none shadow-lg shadow-orange-900/30"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <p className={`text-center mt-6 ${d ? 'text-orange-100/85' : 'text-orange-800'}`}>
            Don't have an account?{' '}
            <Link href="/register" className={`font-medium transition ${d ? 'text-orange-200 hover:text-white' : 'text-orange-700 hover:text-black'}`}>
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
