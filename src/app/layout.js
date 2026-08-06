import './globals.css';

export const metadata = {
  title: 'Auction Photo App',
  description: 'Fast, professional auction photo management',
  manifest: '/manifest.json',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="bg-black text-white antialiased">
      <body className="min-h-screen bg-black text-white flex flex-col justify-between overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
