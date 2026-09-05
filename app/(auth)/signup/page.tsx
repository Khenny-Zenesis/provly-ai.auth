'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signupSchema, zodErrors } from '@/lib/validation/authSchemas';

type FieldErrors = Record<string, string>;

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState<{ message: string; devCode?: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError('');
    setSuccess(null);

    // R1.2 — client-side validation mirrors the shared schema. The server
    // re-validates independently; this is a UX aid, not the security boundary.
    const parsed = signupSchema.safeParse({ name, email, password });
    if (!parsed.success) {
      setFieldErrors(zodErrors(parsed.error));
      return;
    }

    const res = await fetch('/api/auth/signup', {
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
          <h1 className="auth-title">Check your email</h1>
          <p className="auth-subtitle">{success.message}</p>
          {success.devCode ? (
            <div className="alert alert-success">
              Development hint — verification code: {success.devCode}
            </div>
          ) : null}
          <Link className="link" href={`/verify-email?email=${encodeURIComponent(email)}`}>
            Enter verification code
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit} noValidate>
        <h1 className="auth-title">Create account</h1>
        <p className="auth-subtitle">Start your Provly account.</p>

        {formError ? <div className="alert alert-error">{formError}</div> : null}

        <div className="field">
          <label className="label" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            className={`input ${fieldErrors.name ? 'input-error' : ''}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
          {fieldErrors.name ? <span className="error-text">{fieldErrors.name}</span> : null}
        </div>

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
            autoComplete="new-password"
          />
          {fieldErrors.password ? (
            <span className="error-text">{fieldErrors.password}</span>
          ) : null}
        </div>

        <button className="button" type="submit">
          Create Account
        </button>

        <div className="link-grid">
          <span className="helper-text">
            Already have an account? <Link className="link" href="/signin">Sign in</Link>
          </span>
        </div>
      </form>
    </main>
  );
}
