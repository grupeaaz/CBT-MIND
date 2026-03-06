import Layout from "@/components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Check, ArrowLeft, Mail, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { getDeviceId } from "@/lib/queryClient";

export default function Subscribe() {
  const [, setLocation] = useLocation();
  const winsCount = (() => {
    try { return JSON.parse(localStorage.getItem("cbt_wins") || "[]").length; } catch { return 0; }
  })();
  const canRemindLater = winsCount < 3;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showRestore, setShowRestore] = useState(false);
  const [restoreEmail, setRestoreEmail] = useState("");
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState("");
  const [restoreSuccess, setRestoreSuccess] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Device-Id": getDeviceId() },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError("Connection error. Please try again.");
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreEmail.trim()) {
      setRestoreMessage("Please enter the email you used when subscribing");
      setRestoreSuccess(false);
      return;
    }
    setRestoreLoading(true);
    setRestoreMessage("");
    setRestoreSuccess(false);

    try {
      const deviceId = getDeviceId();
      const res = await fetch("/api/subscription/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Device-Id": getDeviceId() },
        body: JSON.stringify({ email: restoreEmail.trim(), deviceId }),
      });

      const data = await res.json();

      if (data.restored) {
        // Restore name to localStorage if saved on the old device
        if (data.profile?.name) {
          localStorage.setItem("userName", data.profile.name);
        }
        // Restore actual wins and journal entries so Insights rebuilds fully
        if (data.stats?.winsData) {
          const wins = typeof data.stats.winsData === "string" ? data.stats.winsData : JSON.stringify(data.stats.winsData);
          localStorage.setItem("cbt_wins", wins);
        }
        if (data.stats?.journalData) {
          const journal = typeof data.stats.journalData === "string" ? data.stats.journalData : JSON.stringify(data.stats.journalData);
          localStorage.setItem("cbt_journal", journal);
        }
        // Also keep summary stats as backup
        if (data.stats) {
          localStorage.setItem("cbt_stats_backup", JSON.stringify(data.stats));
        }
        setRestoreSuccess(true);
        setRestoreMessage("Subscription restored! Redirecting...");
        setTimeout(() => setLocation("/"), 1500);
      } else {
        setRestoreSuccess(false);
        setRestoreMessage(data.message || "No active subscription found for this email");
      }
    } catch {
      setRestoreSuccess(false);
      setRestoreMessage("Connection error. Please try again.");
    }

    setRestoreLoading(false);
  };

  const benefits = [
    "Unlimited healing sessions",
    "Track all your wins",
    "CBT cognitive distortion analysis",
    "Personal advocacy journal",
  ];

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/wins")}
            data-testid="button-back-subscribe"
            className="p-2 -ml-2 hover:bg-black/5 rounded-full transition-colors"
          >
            <ArrowLeft size={20} className="text-muted-foreground" />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {!showRestore ? (
            <motion.div
              key="subscribe"
              initial={{ opacity: 0, x: 0 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-primary/15 rounded-full flex items-center justify-center mx-auto">
                  <Shield size={40} className="text-primary" />
                </div>
                <h1 className="font-serif text-3xl text-foreground font-medium">
                  Continue Your Healing
                </h1>
                <p className="text-muted-foreground text-base leading-relaxed max-w-xs mx-auto">
                  You've completed 30 free sessions. Subscribe to keep growing.
                </p>
              </div>

              <div className="glass-card rounded-2xl p-6 space-y-4">
                <div className="text-center">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="font-serif text-4xl font-bold text-foreground">€2.99</span>
                    <span className="text-muted-foreground text-sm">/month</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Billed yearly at €35.88/year</p>
                </div>

                <div className="space-y-3 pt-2">
                  {benefits.map((benefit, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-primary/15 rounded-full flex items-center justify-center flex-shrink-0">
                        <Check size={12} className="text-primary" />
                      </div>
                      <span className="text-sm text-foreground/80">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {error && (
                  <p className="text-sm text-red-500 text-center">{error}</p>
                )}

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSubscribe}
                  disabled={loading}
                  data-testid="button-subscribe"
                  className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-medium text-base shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50"
                >
                  {loading ? "Redirecting..." : "Subscribe Now"}
                </motion.button>

                <p className="text-xs text-center text-muted-foreground/60">
                  Cancel anytime.
                </p>

                {canRemindLater ? (
                  <button
                    onClick={() => setLocation("/")}
                    data-testid="button-remind-later"
                    className="w-full text-center text-sm text-muted-foreground/60 hover:text-muted-foreground py-2 transition-colors"
                  >
                    Remind me later
                  </button>
                ) : (
                  <button
                    disabled
                    data-testid="button-remind-later"
                    className="w-full text-center text-sm text-muted-foreground/30 py-2 cursor-not-allowed"
                  >
                    Remind me later
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowRestore(true)}
                data-testid="button-show-restore"
                className="w-full text-center text-sm text-primary/70 hover:text-primary py-2 transition-colors"
              >
                Already subscribed? Restore your purchase
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="restore"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-primary/15 rounded-full flex items-center justify-center mx-auto">
                  <RefreshCw size={40} className="text-primary" />
                </div>
                <h1 className="font-serif text-3xl text-foreground font-medium">
                  Restore Subscription
                </h1>
                <p className="text-muted-foreground text-base leading-relaxed max-w-xs mx-auto">
                  Enter the email you used when you subscribed and we'll restore your access.
                </p>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
                  <input
                    type="email"
                    value={restoreEmail}
                    onChange={(e) => setRestoreEmail(e.target.value)}
                    placeholder="Email used for subscription"
                    data-testid="input-restore-email"
                    className="w-full bg-white/50 border border-border/50 rounded-2xl pl-11 pr-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/40"
                  />
                </div>

                {restoreMessage && (
                  <p className={`text-sm text-center ${restoreSuccess ? 'text-emerald-600' : 'text-red-500'}`}>
                    {restoreMessage}
                  </p>
                )}

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleRestore}
                  disabled={restoreLoading}
                  data-testid="button-restore"
                  className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-medium text-base shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50"
                >
                  {restoreLoading ? "Checking..." : "Restore My Subscription"}
                </motion.button>
              </div>

              <button
                onClick={() => { setShowRestore(false); setRestoreMessage(""); }}
                data-testid="button-back-to-subscribe"
                className="w-full text-center text-sm text-primary/70 hover:text-primary py-2 transition-colors"
              >
                Back to subscription options
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </Layout>
  );
}
