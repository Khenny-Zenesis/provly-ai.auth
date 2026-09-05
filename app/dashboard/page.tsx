import { redirect } from 'next/navigation';
import { getSessionUser, destroySession } from '@/lib/auth/session';

// R1.10 — the dashboard is protected by a server-side session check; reaching
// it by any route (including direct URL entry) without a valid session bounces
// here to /signin.
async function signOut() {
  'use server';
  await destroySession();
  redirect('/signin');
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect('/signin');
  }

  return (
    <main className="dash-page">
      <div className="auth-card">
        <h1 className="auth-title">Dashboard</h1>
        <p className="auth-subtitle">Signed in as {user.name}</p>
        <form action={signOut}>
          <button className="button button-secondary" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
