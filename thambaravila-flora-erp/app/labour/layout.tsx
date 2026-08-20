import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Thambaravila Labour Attendance',
  description: 'Mobile attendance and daily meal requests for Thambaravila Flora labour teams.',
  manifest: '/manifest-labour.json',
  appleWebApp: { capable: true, title: 'Flora Labour', statusBarStyle: 'black-translucent' },
};

export default function LabourLayout({ children }: { children: React.ReactNode }) {
  return children;
}
