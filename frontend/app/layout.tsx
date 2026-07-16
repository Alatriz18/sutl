import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';

export const metadata: Metadata = {
  title: 'SUTL — Sistema Universal de Tracking Logístico',
  description: 'Plataforma SaaS de tracking logístico para Ecuador/LATAM.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-white text-navy antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
