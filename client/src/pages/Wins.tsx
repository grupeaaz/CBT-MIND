import Layout from "@/components/Layout";
import { Trophy } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { getDeviceId } from "@/lib/queryClient";

const focusColors: Record<string, string> = {
  "Bad Memory": "bg-[#FFF0F0] text-[#FF4D4D] border-[#FFCCCC]",
  "Bad Thought": "bg-[#FFF9E6] text-[#FFB300] border-[#FFE599]",
  "Bad Experience": "bg-[#E6E6FF] text-[#4D4DFF] border-[#CCCCFF]",
  "Anxiety": "bg-[#E6FFFA] text-[#00BFA5] border-[#B2DFDB]",
};

export default function Wins() {
  const { data: wins = [] } = useQuery({
    queryKey: ["/api/wins"],
    queryFn: async () => {
      const res = await fetch("/api/wins", { headers: { "X-Device-Id": getDeviceId() } });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return {
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      time: d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    };
  };

  return (
    <Layout>
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-amber-400 rounded-full flex items-center justify-center">
            <Trophy size={20} className="text-white" />
          </div>
          <h1 className="font-serif text-4xl text-foreground font-medium">Wins</h1>
        </div>
        <p className="text-muted-foreground">Every time you let it slide, you win.</p>
      </header>

      {wins.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center">
          <Trophy size={48} className="text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">No wins yet.</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Go to Focus and let something slide!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {wins.map((win: any, i: number) => {
            const { date, time } = formatDateTime(win.createdAt);
            const colorClass = focusColors[win.focusArea] || "bg-white/50 text-foreground border-border";
            return (
              <motion.div
                key={win.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card rounded-2xl p-5"
                data-testid={`win-${win.id}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full border ${colorClass}`}>
                    {win.focusArea}
                  </span>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{date}</p>
                    <p className="text-xs text-muted-foreground">{time}</p>
                  </div>
                </div>
                {win.nameIt && (
                  <p className="text-sm text-foreground/80 leading-relaxed mb-2">{win.nameIt}</p>
                )}
                {win.dysfunctions && win.dysfunctions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {win.dysfunctions.map((d: string, j: number) => (
                      <span key={j} className="text-xs text-primary/60 bg-primary/5 px-2 py-0.5 rounded-full">
                        {d.split(" - ")[0].split(" (")[0]}
                      </span>
                    ))}
                  </div>
                )}
                {win.advocacy && (
                  <p className="text-xs text-emerald-600/80 italic mt-2 border-l-2 border-emerald-300 pl-3">
                    {win.advocacy}
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}