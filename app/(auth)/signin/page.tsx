'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signinSchema, zodErrors } from '@/lib/validation/authSchemas';

type FieldErrors = Record<string, string>;

export default function SigninPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError('');

    const parsed = signinSchema.safeParse({ email, password });
    if (!parsed.success) {
      setFieldErrors(zodErrors(parsed.error));
      return;
    }

    const res = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    });

    const data = await res.json();

    if (!res.ok) {
      if (data.errors) setFieldErrors(data.errors);
      setFormError(data.message ?? 'Sign in failed.');
      return;
    }

    router.push('/dashboard');
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit} noValidate>
        <h1 className="auth-title">Sign in</h1>
        <p className="auth-subtitle">Welcome back to Provly.</p>

        {formError ? <div className="alert alert-error">{formError}</div> : null}

        <div className="field">
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className={`input ${fieldErrors.email ? 'input-error' : ''}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          {fieldErrors.email ? <span className="error-text">{fieldErrors.email}</span> : null}
        </div>

        <div className="field">
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className={`input ${fieldErrors.password ? 'input-error' : ''}`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {fieldErrors.password ? (
            <span className="error-text">{fieldErrors.password}</span>
          ) : null}
        </div>

        <button className="button" type="submit">
          Sign In
        </button>

        <div className="link-grid">
          <Link className="link" href="/forgot-password">
            Forgot password?
          </Link>
          <span className="helper-text">
            New here?{' '}
            <Link className="link" href="/signup">
              Create an account
            </Link>
          </span>
        </div>
      </form>
    </main>
  );
}
