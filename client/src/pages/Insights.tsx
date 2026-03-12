import Layout from "@/components/Layout";
import { motion } from "framer-motion";
import { getDeviceId } from "@/lib/queryClient";
import { Trophy, Brain, Sparkles, RefreshCw, Star, Flame, BookOpen, Zap } from "lucide-react";
import { useMemo, useEffect, useState } from "react";

function formatDistortionName(name: string): string {
  const withoutParens = name.replace(/\s*\([^)]*\)$/, "").trim();
  return withoutParens.replace(" - ", ". ");
}

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

    return { key, path, color: FOCUS_COLORS[key] || "#94A3B8" };
  });

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 100 100" className="w-28 h-28 flex-shrink-0 drop-shadow-md">
        {segments.map((seg) => (
          <path key={seg.key} d={seg.path} fill={seg.color} opacity={0.9} />
        ))}
        <circle cx="50" cy="50" r="22" fill="white" opacity="0.95" />
        <text x="50" y="50" textAnchor="middle" dominantBaseline="central" className="text-[13px] font-bold fill-foreground">
          {total}
        </text>
      </svg>
      <div className="flex flex-col gap-2">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: FOCUS_COLORS[key] || "#94A3B8" }} />
            <span className="text-base text-muted-foreground">{FOCUS_LABELS[key] || key}</span>
            <span className="font-bold text-base ml-auto">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WinnerTitle({ totalWins }: { totalWins: number }) {
  if (totalWins === 0) return null;
  if (totalWins >= 50) return <span className="text-white font-semibold">At Peace</span>;
  if (totalWins >= 20) return <span className="text-white font-semibold">Flourishing</span>;
  if (totalWins >= 10) return <span className="text-white font-semibold">Growing</span>;
  if (totalWins >= 5)  return <span className="text-white font-semibold">Healing</span>;
  return <span className="text-white font-semibold">Beginning</span>;
}

export default function Insights() {
  // DB is the single source of truth for all stats
  const [serverStats, setServerStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user/stats", { headers: { "X-Device-Id": getDeviceId() } })
      .then(res => res.ok ? res.json() : null)
      .then(freshStats => { setServerStats(freshStats); setStatsLoading(false); })
      .catch(() => { setStatsLoading(false); });
  }, []);

  // Use the higher of local journal count vs server reflections (covers all devices)
  const journalCount = useMemo(() => {
    const local = (() => { try { return JSON.parse(localStorage.getItem("cbt_journal") || "[]").length; } catch { return 0; } })();
    return Math.max(local, serverStats?.reflections || 0);
  }, [serverStats]);

  // Parse winsData from DB for topDysfunctions and daily insight AI query
  const serverWinsData = useMemo<any[]>(() => {
    try { return JSON.parse(serverStats?.winsData || "[]"); } catch { return []; }
  }, [serverStats]);

  const stats = useMemo(() => {
    const localWinsCount = (() => { try { return JSON.parse(localStorage.getItem("cbt_wins") || "[]").length; } catch { return 0; } })();
    const totalWins = Math.max(serverStats?.totalWins || 0, localWinsCount);
    // Active Days = unique calendar days where at least 1 win was recorded
    const localWins: any[] = (() => { try { return JSON.parse(localStorage.getItem("cbt_wins") || "[]"); } catch { return []; } })();
    const localActiveDays = new Set(localWins.map((w: any) => w.createdAt?.split("T")[0]).filter(Boolean)).size;
    const activeDays = Math.max(localActiveDays, serverStats?.activeDays || 0);
    const focusBreakdown = (() => {
      if (!serverStats?.focusBreakdown) return {};
      try { return typeof serverStats.focusBreakdown === "string" ? JSON.parse(serverStats.focusBreakdown) : serverStats.focusBreakdown; }
      catch { return {}; }
    })();
    const allDysfunctions: Record<string, number> = {};
    serverWinsData.forEach((w: any) => {
      if (w.dysfunctions) {
        w.dysfunctions.forEach((d: string) => { allDysfunctions[d] = (allDysfunctions[d] || 0) + 1; });
      }
    });
    return {
      totalWins,
      activeDays,
      focusBreakdown,
      topDysfunctions: Object.entries(allDysfunctions).sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [serverStats, serverWinsData]);

  const hasWins = serverStats !== null && (serverStats.totalWins > 0 || serverStats.activeDays > 0);

  const today = new Date().toISOString().split("T")[0];
  const localInsightKey = `cbt_daily_insight_${today}`;

  const [insightText, setInsightText] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState(false);

  useEffect(() => {
    if (!hasWins || statsLoading) return;

    // Return cached insight immediately if available
    const cached = localStorage.getItem(localInsightKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed?.insight) { setInsightText(parsed.insight); return; }
      } catch {}
      localStorage.removeItem(localInsightKey);
    }

    setInsightLoading(true);
    setInsightError(false);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const email = localStorage.getItem("cbt_user_email") || undefined;
    fetch("/api/insights/daily", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Device-Id": getDeviceId() },
      body: JSON.stringify({ wins: serverWinsData, email }),
      signal: controller.signal,
    })
      .then(res => res.ok ? res.json() : Promise.reject(res.status))
      .then(data => {
        if (data?.insight) {
          localStorage.setItem(localInsightKey, JSON.stringify(data));
          setInsightText(data.insight);
        } else {
          setInsightError(true);
        }
      })
      .catch(() => setInsightError(true))
      .finally(() => { clearTimeout(timeoutId); setInsightLoading(false); });

    return () => { clearTimeout(timeoutId); controller.abort(); };
  }, [hasWins, statsLoading]);

  return (
    <Layout>
      {/* Hero header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-3xl overflow-hidden mb-6 p-6"
        style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)" }}
      >
        {/* Decorative stars */}
        <Star size={14} className="absolute top-4 right-8 text-white/40 fill-white/40" />
        <Star size={8}  className="absolute top-8 right-16 text-white/30 fill-white/30" />
        <Star size={10} className="absolute bottom-6 right-12 text-white/30 fill-white/30" />
        <Star size={6}  className="absolute top-5 left-20 text-white/20 fill-white/20" />

        <div className="flex items-center gap-4">
          <motion.div
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
            className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg"
          >
            <Trophy size={34} className="text-white" />
          </motion.div>
          <div>
            <p className="text-white/80 text-sm font-medium uppercase tracking-widest mb-0.5">
              {hasWins ? <WinnerTitle totalWins={stats.totalWins} /> : "Your Journey"}
            </p>
            <h1 className="font-serif text-3xl text-white font-bold leading-tight" data-testid="text-insights-title">
              {hasWins ? `${stats.totalWins} wins strong` : "Insights"}
            </h1>
            <p className="text-white/70 text-sm mt-1">
              {hasWins ? "Every step counts. You're doing it." : "Start your journey to see your wins here."}
            </p>
          </div>
        </div>
      </motion.div>

      <div className="space-y-5">

        {/* Stat cards */}
        {hasWins && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-3 gap-3"
          >
            <div className="rounded-2xl p-4 text-center shadow-sm" style={{ background: "linear-gradient(135deg, #fef3c7, #fde68a)" }}>
              <div className="flex justify-center mb-1">
                <Trophy size={18} className="text-amber-600" />
              </div>
              <div className="text-2xl font-bold text-amber-700" data-testid="text-total-wins">{stats.totalWins}</div>
              <div className="text-xs font-medium text-amber-600 mt-0.5">Total Wins</div>
            </div>
            <div className="rounded-2xl p-4 text-center shadow-sm" style={{ background: "linear-gradient(135deg, #fee2e2, #fca5a5)" }}>
              <div className="flex justify-center mb-1">
                <Flame size={18} className="text-red-500" />
              </div>
              <div className="text-2xl font-bold text-red-600" data-testid="text-active-days">{stats.activeDays}</div>
              <div className="text-xs font-medium text-red-500 mt-0.5">Active Days</div>
            </div>
            <div className="rounded-2xl p-4 text-center shadow-sm" style={{ background: "linear-gradient(135deg, #d1fae5, #6ee7b7)" }}>
              <div className="flex justify-center mb-1">
                <BookOpen size={18} className="text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-emerald-700">{journalCount}</div>
              <div className="text-xs font-medium text-emerald-600 mt-0.5">Reflections</div>
            </div>
          </motion.div>
        )}

        {/* Daily insight */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-3xl overflow-hidden shadow-sm"
          style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)" }}
        >
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={18} className="text-yellow-300" />
              <h2 className="font-medium text-lg text-white">Today's Wisdom</h2>
            </div>

            {!hasWins ? (
              <div className="text-center py-6">
                <Sparkles size={32} className="mx-auto mb-2 text-white/30" />
                <p className="text-white/50 text-sm">Your daily wisdom appears once you start building wins.</p>
              </div>
            ) : insightLoading ? (
              <div className="flex items-center gap-3 text-white/60 text-sm py-4">
                <RefreshCw size={16} className="animate-spin" />
                <span>Preparing today's wisdom...</span>
              </div>
            ) : insightError ? (
              <p className="text-white/50 text-sm py-4">Could not load today's insight. Please check your connection.</p>
            ) : insightText ? (
              <div className="space-y-3" data-testid="text-ai-insight">
                {insightText
                  .split(/[.!?]+/)
                  .map((s: string) => s.trim())
                  .filter((s: string) => s.length > 0)
                  .map((sentence: string, i: number) => (
                    <p key={i} className="text-white/90 text-base leading-relaxed flex gap-2">
                      <span className="text-yellow-300 mt-0.5">✦</span>
                      <span>{sentence}.</span>
                    </p>
                  ))}
              </div>
            ) : (
              <p className="text-white/50 text-sm py-4">Unable to load today's insight. Please check back later.</p>
            )}
          </div>
        </motion.div>

        {/* Journey stats card */}
        {hasWins && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card p-5 rounded-3xl"
          >
            <div className="flex items-center gap-2 mb-5">
              <Zap size={18} className="text-primary" />
              <h2 className="font-medium text-lg">Your Patterns</h2>
            </div>

            <div className="space-y-6">
              {stats.focusBreakdown && Object.keys(stats.focusBreakdown).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">Focus breakdown</p>
                  <MiniPieChart data={stats.focusBreakdown} />
                </div>
              )}

              {stats.topDysfunctions && stats.topDysfunctions.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">Patterns you've overcome</p>
                  <div className="flex flex-wrap gap-2">
                    {stats.topDysfunctions.map(([name, count]: [string, number]) => (
                      <span key={name} className="inline-flex items-center gap-1.5 bg-primary/8 border border-primary/15 text-foreground text-sm px-3 py-1.5 rounded-full">
                        <Brain size={12} className="text-primary" />
                        {formatDistortionName(name)}
                        <span className="font-bold text-primary">{count}×</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Empty state */}
        {!hasWins && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="glass-card rounded-3xl p-8 text-center"
          >
            <Trophy size={48} className="text-amber-300 mx-auto mb-4" />
            <p className="font-serif text-xl text-foreground font-medium mb-2">Your wins will shine here</p>
            <p className="text-muted-foreground text-sm">Go to Focus, name a thought, and let it go. Every win counts.</p>
          </motion.div>
        )}

      </div>
    </Layout>
  );
}
