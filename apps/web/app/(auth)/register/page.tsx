'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';

export default function RegisterPage(): JSX.Element {
  const router = useRouter();
  const register = useAuthStore((state) => state.register);
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await register(username, password);
      bootstrap();
      router.push('/chat');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center bg-slate-950">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl bg-slate-900 p-8 shadow-xl">
        <h1 className="text-2xl font-semibold text-slate-100">Create account</h1>
        <p className="mt-1 text-sm text-slate-400">Choose a username and password.</p>
        <div className="mt-6 flex flex-col gap-4">
          <label className="text-sm text-slate-300">
            Username
            <input
              type="text"
              className="mt-1 w-full rounded-lg bg-slate-950 px-3 py-2 text-slate-100 focus:outline-none"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>
          <label className="text-sm text-slate-300">
            Password
            <input
              type="password"
              className="mt-1 w-full rounded-lg bg-slate-950 px-3 py-2 text-slate-100 focus:outline-none"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
            />
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          className="mt-6 w-full rounded-full bg-brand-500 py-2 text-sm font-semibold text-white hover:bg-brand-500/90 disabled:opacity-60"
          disabled={loading}
        >
          {loading ? 'Creating…' : 'Sign up'}
        </button>
        <p className="mt-4 text-center text-xs text-slate-500">
          Already registered?{' '}
          <Link href="/login" className="text-brand-500 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
