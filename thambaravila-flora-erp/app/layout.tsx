import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import ClientAppLayout from './components/ClientAppLayout';

export const metadata: Metadata = {
  title: 'Thambaravila Flora ERP',
  description: 'Internal Private ERP for wedding floristry & event decor',
  manifest: '/manifest.json',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#222826" />
      </head>
      <body className="bg-transparent text-slate-100 min-h-screen antialiased" suppressHydrationWarning>
        <Providers>
          <ClientAppLayout>{children}</ClientAppLayout>
        </Providers>
      </body>
    </html>
  );
}
