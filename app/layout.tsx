import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Provly — Authentication',
  description: 'Provly Assessment 1 authentication slice',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
