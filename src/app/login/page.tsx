"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Invalid credentials');
        return;
      }
      router.push('/');
    } catch {
      setError('Network error — try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-[360px]">
        {/* Mark */}
        <div className="flex items-center gap-2.5 mb-10 justify-center">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-accent text-white text-sm font-bold">
            V
          </span>
          <span className="text-xl font-semibold tracking-tight text-ink">Voxray</span>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-xl p-7 shadow-sm">
          <h1 className="text-[17px] font-semibold text-ink mb-1">Sign in</h1>
          <p className="text-sm text-ink-3 mb-6">Access is invite-only.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1.5">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                autoFocus
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full h-9 px-3 rounded-lg border border-border bg-canvas text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent-border transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1.5">Password</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                autoComplete="current-password"
                className="w-full h-9 px-3 rounded-lg border border-border bg-canvas text-sm text-ink focus:outline-none focus:border-accent-border transition-colors"
              />
            </div>

            {error && (
              <p className="text-xs text-crit bg-crit-bg border border-crit-border px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-9 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-1"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
