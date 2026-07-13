"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sun,
  CheckSquare,
  Repeat,
  BookOpen,
  Wallet,
  HeartPulse,
  CalendarCheck,
  Utensils,
  type LucideIcon,
} from "lucide-react";

// desktopOnly keeps the mobile bottom bar at six tabs; those pages stay
// reachable from Today/Journal links.
const links: {
  href: string;
  label: string;
  icon: LucideIcon;
  desktopOnly?: boolean;
}[] = [
  { href: "/today", label: "Today", icon: Sun },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/habits", label: "Habits", icon: Repeat },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/money", label: "Money", icon: Wallet },
  { href: "/health", label: "Health", icon: HeartPulse },
  { href: "/review", label: "Review", icon: CalendarCheck, desktopOnly: true },
  { href: "/meals", label: "Meals", icon: Utensils, desktopOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  if (pathname.startsWith("/login") || pathname.startsWith("/auth")) return null;
  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col gap-1 border-r border-black/10 dark:border-white/10 p-4">
      <Link href="/today" className="mb-4 px-3 text-lg font-bold tracking-tight">
        Megaapp
      </Link>
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-black/5 dark:bg-white/10"
                : "text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            <Icon size={18} strokeWidth={2} />
            {label}
          </Link>
        );
      })}
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/login") || pathname.startsWith("/auth")) return null;
  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-10 border-t border-black/10 dark:border-white/10 bg-background/90 backdrop-blur">
      <div className="flex justify-around pb-[env(safe-area-inset-bottom)]">
        {links.filter((l) => !l.desktopOnly).map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 px-3 py-2 text-[11px] font-medium ${
                active ? "" : "text-black/50 dark:text-white/50"
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.25 : 2} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
