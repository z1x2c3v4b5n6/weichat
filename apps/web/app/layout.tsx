import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Weichat MVP',
  description: 'Real-time messaging MVP built with Next.js 15'
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <div className="h-screen w-full">{children}</div>
      </body>
    </html>
  );
}
