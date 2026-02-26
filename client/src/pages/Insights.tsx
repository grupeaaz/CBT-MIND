import Layout from "@/components/Layout";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { getDeviceId } from "@/lib/queryClient";
import { BarChart3, Trophy, Brain, Sparkles, RefreshCw } from "lucide-react";

const FOCUS_COLORS: Record<string, string> = {
  "Bad Memory": "#8B5CF6",
  "Bad Thought": "#3B82F6",
  "Bad Experience": "#F59E0B",
  "Anxiety": "#EF4444",
};

const FOCUS_LABELS: Record<string, string> = {
  "Bad Memory": "Memory",
  "Bad Thought": "Thought",
  "Bad Experience": "Experience",
  "Anxiety": "Anxiety",
};

function MiniPieChart({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const entries = Object.entries(data);
  let currentAngle = -90;

  const segments = entries.map(([key, value]) => {
    const percentage = (value / total) * 100;
    const angle = (value / total) * 360;
    const startAngle = currentAngle;
    currentAngle += angle;
    const endAngle = currentAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const largeArc = angle > 180 ? 1 : 0;

    const x1 = 50 + 40 * Math.cos(startRad);
    const y1 = 50 + 40 * Math.sin(startRad);
    const x2 = 50 + 40 * Math.cos(endRad);
    const y2 = 50 + 40 * Math.sin(endRad);

    const path = entries.length === 1
      ? `M 50 50 m -40 0 a 40 40 0 1 0 80 0 a 40 40 0 1 0 -80 0`
      : `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;

    return { key, path, color: FOCUS_COLORS[key] || "#94A3B8", percentage };
  });

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="w-28 h-28 flex-shrink-0">
        {segments.map((seg) => (
          <path key={seg.key} d={seg.path} fill={seg.color} opacity={0.85} />
        ))}
        <circle cx="50" cy="50" r="20" fill="white" opacity="0.9" />
        <text x="50" y="50" textAnchor="middle" dominantBaseline="central" className="text-[11px] font-bold fill-foreground">
          {total}
        </text>
      </svg>
      <div className="flex flex-col gap-1.5">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-center gap-2 text-sm">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: FOCUS_COLORS[key] || "#94A3B8" }} />
            <span className="text-muted-foreground">{FOCUS_LABELS[key] || key}</span>
            <span className="font-medium ml-auto">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Insights() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/insights/stats"],
    queryFn: async () => {
      const res = await fetch("/api/insights/stats", { headers: { "X-Device-Id": getDeviceId() } });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const hasWins = stats && stats.totalWins > 0;

  const { data: dailyInsight, isLoading: insightLoading } = useQuery({
    queryKey: ["/api/insights/daily"],
    queryFn: async () => {
      const res = await fetch("/api/insights/daily", { headers: { "X-Device-Id": getDeviceId() } });
      if (!res.ok) throw new Error("Failed to fetch insight");
      return res.json();
    },
    enabled: hasWins,
    staleTime: 1000 * 60 * 60,
  });

  return (
    <Layout>
      <header className="mb-6">
        <h1 className="font-serif text-4xl text-foreground font-medium mb-2" data-testid="text-insights-title">Insights</h1>
        <p className="text-muted-foreground">Your healing journey at a glance.</p>
      </header>

      <div className="space-y-5">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-5 rounded-2xl"
        >
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={18} className="text-amber-500" />
            <h2 className="font-medium text-lg">Day Insight</h2>
          </div>

          {!hasWins ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <Sparkles size={32} className="mx-auto mb-2 opacity-40" />
              <p>Your daily insight will appear here once you start building your wins.</p>
            </div>
          ) : insightLoading ? (
            <div className="flex items-center justify-center py-6">
              <div className="flex items-center gap-3 text-muted-foreground text-sm">
                <RefreshCw size={16} className="animate-spin" />
                <span>Preparing today's insight...</span>
              </div>
            </div>
          ) : dailyInsight?.insight ? (
            <div className="space-y-1.5 text-foreground/85" data-testid="text-ai-insight">
              {dailyInsight.insight
                .split(/[.!?]+/)
                .map((s: string) => s.trim())
                .filter((s: string) => s.length > 0)
                .map((sentence: string, i: number) => (
                  <p key={i} className="text-sm leading-relaxed">— {sentence}.</p>
                ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <p>Unable to load today's insight. Please check back later.</p>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-card p-5 rounded-2xl"
        >
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-primary" />
            <h2 className="font-medium text-lg">Journey Stats</h2>
          </div>

          {statsLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">Loading...</div>
          ) : !hasWins ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <Trophy size={32} className="mx-auto mb-2 opacity-40" />
              <p>Complete your first focus session to see your stats here.</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-primary/5 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-primary" data-testid="text-total-wins">{stats.totalWins}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Total Wins</div>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-amber-600" data-testid="text-active-days">{stats.activeDays}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Active Days</div>
                </div>
              </div>

              {stats.focusBreakdown && Object.keys(stats.focusBreakdown).length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Focus Area Breakdown</h3>
                  <MiniPieChart data={stats.focusBreakdown} />
                </div>
              )}

              {stats.topDysfunctions && stats.topDysfunctions.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Common Patterns</h3>
                  <div className="flex flex-wrap gap-2">
                    {stats.topDysfunctions.map(([name, count]: [string, number]) => (
                      <span key={name} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full">
                        <Brain size={11} />
                        {name}
                        <span className="font-bold">{count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </Layout>
  );
}
