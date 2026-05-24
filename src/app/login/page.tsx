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
      router.push('/dashboard');
    } catch {
      setError('Network error — try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4 relative overflow-hidden">

      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            'radial-gradient(ellipse 60% 40% at 50% 40%, oklch(65% 0.18 55 / 0.13) 0%, transparent 70%)',
            'radial-gradient(ellipse 40% 30% at 50% 60%, oklch(55% 0.22 55 / 0.07) 0%, transparent 60%)',
          ].join(', '),
        }}
      />

      <div className="w-full max-w-[380px] relative z-10">

        {/* Logo */}
        <div className="flex items-center gap-3 mb-10 justify-center">
          <span className="inline-flex items-center justify-center w-8 h-8 bg-accent text-canvas font-black text-[13px]">
            V
          </span>
          <span className="text-[18px] font-bold tracking-tight text-ink">Voxray</span>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border p-8">

          {/* Header */}
          <div className="mb-7">
            <h1 className="text-[17px] font-bold text-ink mb-1 tracking-tight">Sign in</h1>
            <p className="text-[12px] uppercase tracking-[0.16em] text-ink-3 font-[family-name:var(--font-mono)]">
              Access is invite-only
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3 mb-2 font-[family-name:var(--font-mono)]">
                Email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                autoFocus
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full h-10 px-3 border border-border bg-canvas text-[13px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3 mb-2 font-[family-name:var(--font-mono)]">
                Password
              </label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                autoComplete="current-password"
                className="w-full h-10 px-3 border border-border bg-canvas text-[13px] text-ink focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            {error && (
              <p className="text-[11px] text-crit bg-crit-bg border border-crit-border px-3 py-2 font-[family-name:var(--font-mono)]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-accent hover:bg-accent-hover text-canvas text-[11px] font-bold uppercase tracking-[0.12em] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2 border border-accent-border font-[family-name:var(--font-mono)]"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>

          </form>
        </div>

        {/* Footer hint */}
        <p className="text-center text-[10px] uppercase tracking-[0.18em] text-ink-3/50 mt-6 font-[family-name:var(--font-mono)]">
          Voxray · Voice AI Observability
        </p>

      </div>
    </div>
  );
}
