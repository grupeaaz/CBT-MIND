import Layout from "@/components/Layout";
import QuoteCard from "@/components/QuoteCard";
import MoodTracker from "@/components/MoodTracker";
import MeditationPlayer from "@/components/MeditationPlayer";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { getDeviceId } from "@/lib/queryClient";

export default function Home() {
  const { data: entries = [] } = useQuery({
    queryKey: ["/api/journal"],
    queryFn: async () => {
      const res = await fetch("/api/journal", { headers: { "X-Device-Id": getDeviceId() } });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const recentEntries = entries.slice(0, 3);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <Layout>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="space-y-8"
      >
        <header className="flex justify-between items-center mb-8">
          <div>
            <p className="text-muted-foreground text-sm uppercase tracking-widest font-medium mb-1">{dateStr}</p>
            <h1 className="font-serif text-4xl text-foreground font-medium">Be Present.</h1>
          </div>
          <div className="flex flex-col items-center gap-1">
            <img src="/icon-512-letitgo.png" alt="CBT Guide Logo" className="w-10 h-10 object-contain" />
            <span className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase">CBT GUIDE</span>
          </div>
        </header>

        <section>
          <QuoteCard />
        </section>

        <section>
          <MoodTracker />
        </section>

        <section>
          <div className="flex items-center justify-between mb-4 mt-8">
            <h3 className="font-serif text-2xl text-foreground">Daily Practice</h3>
            <span className="text-xs font-bold bg-primary/10 text-primary px-3 py-1 rounded-full uppercase tracking-wider">Recommended</span>
          </div>
          <MeditationPlayer />
        </section>

        <section className="pb-8">
          <h3 className="font-serif text-2xl text-foreground mb-4 mt-8">Recent Reflections</h3>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6">
            {recentEntries.length > 0 ? (
              recentEntries.map((entry: any) => (
                <div key={entry.id} className="min-w-[240px] glass-card p-5 rounded-2xl flex-shrink-0" data-testid={`reflection-${entry.id}`}>
                  <p className="text-xs text-muted-foreground mb-2">{formatDate(entry.date)}</p>
                  <p className="text-sm line-clamp-2 text-foreground/80 font-medium">
                    {entry.content}
                  </p>
                </div>
              ))
            ) : (
              <div className="min-w-[240px] glass-card p-5 rounded-2xl flex-shrink-0 opacity-60">
                <p className="text-xs text-muted-foreground mb-2">No entries yet</p>
                <p className="text-sm text-foreground/60 font-medium italic">
                  Visit the Journal to begin writing your reflections...
                </p>
              </div>
            )}
          </div>
        </section>
      </motion.div>
    </Layout>
  );
}