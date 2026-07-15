import type { Metadata } from 'next';
import './globals.css';

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
      <body className="bg-white text-navy antialiased">{children}</body>
    </html>
  );
}
