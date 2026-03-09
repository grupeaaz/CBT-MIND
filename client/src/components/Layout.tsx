import { Link, useLocation } from "wouter";
import { Crosshair, Feather, BookOpen, User, Sparkles, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const winsCount = (() => {
    try { return JSON.parse(localStorage.getItem("cbt_wins") || "[]").length; } catch { return 0; }
  })();

  const navItems = [
    { href: "/", icon: Crosshair, label: "Focus" },
    { href: "/wins", icon: Star, label: "Wins", badge: winsCount },
    { href: "/insights", icon: Sparkles, label: "Insights" },
    { href: "/journal", icon: Feather, label: "Journal" },
    { href: "/profile", icon: User, label: "Profile" },
  ];

  return (
    <>
      {/* ── Mobile layout (< lg) ── */}
      <div className="lg:hidden min-h-screen flex flex-col max-w-md mx-auto bg-background/50 relative overflow-hidden shadow-2xl">
        <main className="flex-1 overflow-y-auto pb-24 px-6 pt-8 scrollbar-hide">
          {children}
        </main>

        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-t border-border z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="flex justify-around items-center h-20 px-2">
            {navItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href} className={cn(
                  "flex flex-col items-center justify-center w-14 h-16 rounded-2xl transition-all duration-300 relative",
                  isActive
                    ? "text-primary scale-110"
                    : "text-muted-foreground hover:text-foreground hover:bg-black/5"
                )} data-testid={`nav-${item.label.toLowerCase()}`}>
                  <item.icon
                    size={22}
                    strokeWidth={isActive ? 2 : 1.5}
                    className={cn("transition-all duration-300", isActive && "drop-shadow-sm")}
                  />
                  {"badge" in item && (item as any).badge > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-amber-400 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                      {(item as any).badge}
                    </span>
                  )}
                  <span className={cn(
                    "text-[10px] mt-1 font-medium tracking-wide transition-opacity duration-300",
                    isActive ? "opacity-100" : "opacity-0 translate-y-2 absolute"
                  )}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      {/* ── Desktop layout (≥ lg) ── */}
      <div className="hidden lg:flex min-h-screen bg-background">

        {/* Sidebar */}
        <aside className="fixed top-0 left-0 h-full w-64 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-r border-border flex flex-col py-8 px-4 z-50">
          <div className="flex items-center gap-3 px-2 mb-10">
            <img src="/icon-512-letitgo.png" alt="CBT Guide" className="w-14 h-14 object-contain" />
            <span className="text-sm font-bold tracking-widest text-muted-foreground uppercase">CBT Guide</span>
          </div>

          <nav className="flex flex-col gap-2">
            {navItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href} className={cn(
                  "flex items-center gap-4 px-4 py-4 rounded-2xl transition-all duration-200 relative",
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-black/5"
                )} data-testid={`nav-${item.label.toLowerCase()}`}>
                  <item.icon
                    size={24}
                    strokeWidth={isActive ? 2 : 1.5}
                    className="flex-shrink-0"
                  />
                  <span className="text-base">{item.label}</span>
                  {"badge" in item && (item as any).badge > 0 && (
                    <span className="ml-auto min-w-[18px] h-[18px] bg-amber-400 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                      {(item as any).badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <main className="ml-64 flex-1 flex justify-center py-10 px-6 overflow-y-auto">
          <div className="w-full max-w-2xl">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}