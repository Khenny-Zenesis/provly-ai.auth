'use client';

import { useState } from 'react';
import Link from 'next/link';
import { forgotPasswordSchema, zodErrors } from '@/lib/validation/authSchemas';

type FieldErrors = Record<string, string>;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState<{ message: string; devResetUrl?: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError('');
    setSuccess(null);

    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setFieldErrors(zodErrors(parsed.error));
      return;
    }

    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    });

    const data = await res.json();

    if (!res.ok) {
      if (data.errors) setFieldErrors(data.errors);
      setFormError(data.message ?? 'Something went wrong.');
      return;
    }

    setSuccess(data);
  }

  if (success) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <h1 className="auth-title">Reset link sent</h1>
          <p className="auth-subtitle">{success.message}</p>
          {success.devResetUrl ? (
            <div className="alert alert-success">
              Development hint —{' '}
              <Link className="link" href={success.devResetUrl}>
                open reset link
              </Link>
            </div>
          ) : null}
          <Link className="link" href="/signin">
            Back to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit} noValidate>
        <h1 className="auth-title">Forgot password</h1>
        <p className="auth-subtitle">We&apos;ll email you a link to reset it.</p>

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

        <button className="button" type="submit">
          Send Reset Link
        </button>

        <div className="link-grid">
          <Link className="link" href="/signin">
            Back to sign in
          </Link>
        </div>
      </form>
    </main>
  );
}
