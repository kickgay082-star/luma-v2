import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Luma — 3D Sosyal Sinema ve Ortak İzleme Platformu',
  description:
    'Gerçek zamanlı multiplayer 3D sanal odalar, özelleştirilebilir avatarlar, konumsal sesli sohbet, YouTube ve IPTV izleme deneyimi.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${jakarta.variable} ${jetbrains.variable} dark`}>
      <body className="min-h-screen bg-[#090A0F] text-[#F3F4F6] antialiased selection:bg-[#7C5CFF]/30 selection:text-white">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
