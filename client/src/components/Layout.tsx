import { Link, useLocation } from "wouter";
import { Crosshair, Feather, BookOpen, User, Sparkles, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getDeviceId } from "@/lib/queryClient";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const { data: wins = [] } = useQuery({
    queryKey: ["/api/wins"],
    queryFn: async () => {
      const res = await fetch("/api/wins", { headers: { "X-Device-Id": getDeviceId() } });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const navItems = [
    { href: "/", icon: Crosshair, label: "Focus" },
    { href: "/wins", icon: Star, label: "Wins", badge: wins.length },
    { href: "/insights", icon: Sparkles, label: "Insights" },
    { href: "/journal", icon: Feather, label: "Journal" },
    { href: "/profile", icon: User, label: "Profile" },
  ];

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto bg-background/50 relative overflow-hidden shadow-2xl">
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
  );
}