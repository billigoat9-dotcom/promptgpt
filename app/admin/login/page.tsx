'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (requiresTwoFactor && tempToken) {
        const res = await fetch('/api/auth/verify-2fa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tempToken, code: twoFactorCode }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          router.push('/admin');
          router.refresh();
        } else {
          setError(data.error || 'Verification failed');
        }
      } else {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });

        const data = await res.json();

        if (res.ok && data.requiresTwoFactor) {
          setRequiresTwoFactor(true);
          setTempToken(data.tempToken);
          setError('');
        } else if (res.ok && data.success) {
          router.push('/admin');
          router.refresh();
        } else {
          setError(data.error || 'Login failed');
        }
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050507] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center">
              <span className="text-white text-3xl font-bold">P</span>
            </div>
            <span className="text-4xl font-semibold tracking-tighter">PromptGpt</span>
          </div>
          <h1 className="text-2xl font-semibold text-white">Admin Login</h1>
          <p className="text-white/50 mt-1">Sign in to manage prompts</p>
        </div>

        <div className="bg-[#0a0a0f] border border-white/10 rounded-3xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#050507] border border-white/15 rounded-2xl px-4 py-3 text-white focus:border-violet-500 outline-none"
                placeholder="admin"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#050507] border border-white/15 rounded-2xl px-4 py-3 text-white focus:border-violet-500 outline-none"
                placeholder="••••••••"
                required
              />
            </div>

            {requiresTwoFactor && (
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Verification Code</label>
                <input
                  type="text"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  className="w-full bg-[#050507] border border-white/15 rounded-2xl px-4 py-3 text-white focus:border-violet-500 outline-none tracking-[0.35em] text-center"
                  placeholder="123456"
                  inputMode="numeric"
                  required
                />
              </div>
            )}

            {error && (
              <div className="text-red-400 text-sm bg-red-950/50 border border-red-900 rounded-xl px-4 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 disabled:opacity-70 text-white font-semibold py-3.5 rounded-2xl transition-all mt-2"
            >
              {loading ? 'Signing in...' : requiresTwoFactor ? 'Verify Code' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-white/40">
            Use your configured admin credentials
          </div>
        </div>
      </div>
    </div>
  );
}
