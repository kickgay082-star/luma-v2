'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Compass,
  Plus,
  Radio,
  Settings,
  Sparkles,
  User,
  Users,
  LogOut,
  LogIn,
} from 'lucide-react';
import { useLumaStore } from '@/stores/useLumaStore';

interface NavbarProps {
  onCreateRoomClick?: () => void;
}

export function Navbar({ onCreateRoomClick }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useLumaStore((s) => s.user);
  const setUser = useLumaStore((s) => s.setUser);

  const navItems = [
    { href: '/', label: 'Keşfet', icon: Compass },
    { href: '/avatar', label: 'Avatar Stüdyosu', icon: Sparkles },
    { href: '/iptv', label: 'IPTV', icon: Radio },
    { href: '/friends', label: 'Arkadaşlar', icon: Users },
    { href: '/settings', label: 'Ayarlar', icon: Settings },
  ];

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#090A0F]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#151823] transition-colors group-hover:border-[#7C5CFF]/60">
              <span className="h-3 w-3 rounded-full bg-[#7C5CFF] ring-4 ring-[#7C5CFF]/20" />
            </span>
            <span className="text-base font-semibold tracking-tight text-white">
              Luma
              <span className="ml-1.5 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] font-medium text-zinc-400">
                V2
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-white/[0.08] text-white'
                      : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
                  }`}
                >
                  <Icon className="h-4 w-4 opacity-80" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {onCreateRoomClick ? (
            <button
              type="button"
              onClick={onCreateRoomClick}
              className="flex items-center gap-1.5 rounded-lg bg-[#7C5CFF] px-3.5 py-2 text-sm font-medium text-white transition hover:bg-[#6D4AF5]"
            >
              <Plus className="h-4 w-4" />
              <span>Oda Oluştur</span>
            </button>
          ) : (
            <Link
              href="/?create=1"
              className="flex items-center gap-1.5 rounded-lg bg-[#7C5CFF] px-3.5 py-2 text-sm font-medium text-white transition hover:bg-[#6D4AF5]"
            >
              <Plus className="h-4 w-4" />
              <span>Oda Oluştur</span>
            </Link>
          )}

          {user ? (
            <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#10121A] py-1 pl-2.5 pr-1.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#7C5CFF]/20 text-xs font-semibold text-[#C4B5FD]">
                {user.displayName.slice(0, 1).toUpperCase()}
              </div>
              <span className="hidden text-xs font-medium text-zinc-200 sm:inline">
                {user.displayName}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                title="Çıkış Yap"
                className="rounded-md p-1.5 text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <Link
              href="/auth"
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#12141E] px-3 py-2 text-sm font-medium text-zinc-200 transition hover:border-white/20 hover:bg-[#171A27]"
            >
              <LogIn className="h-4 w-4 text-zinc-400" />
              <span>Giriş Yap</span>
            </Link>
          )}
        </div>
      </div>

      {/* Mobile Nav Bar */}
      <div className="flex items-center justify-around border-t border-white/[0.05] px-2 py-1.5 md:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 rounded-md px-2.5 py-1 text-[11px] ${
                active ? 'text-white' : 'text-zinc-500'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label.split(' ')[0]}</span>
            </Link>
          );
        })}
        <Link
          href="/auth"
          className={`flex flex-col items-center gap-0.5 rounded-md px-2.5 py-1 text-[11px] ${
            pathname === '/auth' ? 'text-white' : 'text-zinc-500'
          }`}
        >
          <User className="h-4 w-4" />
          <span>Profil</span>
        </Link>
      </div>
    </header>
  );
}
