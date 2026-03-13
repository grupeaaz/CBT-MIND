import Layout from "@/components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import { useRoute, useLocation } from "wouter";
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { X, ArrowLeft, Trophy, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { getDeviceId } from "@/lib/queryClient";
import { detectSelfHarm, type DetectionResult, type RiskLevel } from "@/lib/selfHarmDetection";
import SelfHarmAlert from "@/components/SelfHarmAlert";

function playWinSound() {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const duration = 2.2;

  // Ocean wave: layered pink-ish noise, slowly swells and fades like a wave washing in and out
  const bufferSize = Math.floor(audioContext.sampleRate * duration);
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = buffer.getChannelData(0);

  // Generate smooth noise by averaging random samples (approximates pink noise texture)
  let runningAvg = 0;
  for (let i = 0; i < bufferSize; i++) {
    runningAvg = runningAvg * 0.97 + (Math.random() * 2 - 1) * 0.03;
    data[i] = runningAvg + (Math.random() * 2 - 1) * 0.15;
  }

  const source = audioContext.createBufferSource();
  source.buffer = buffer;

  // Low-pass filter keeps only the deep, soft rumble of the wave
  const lowPass = audioContext.createBiquadFilter();
  lowPass.type = "lowpass";
  lowPass.frequency.setValueAtTime(420, audioContext.currentTime);
  lowPass.frequency.linearRampToValueAtTime(180, audioContext.currentTime + duration);
  lowPass.Q.value = 0.5;

  // Gentle gain envelope: slow rise like a wave coming in, then a long calm fade out
  const gainNode = audioContext.createGain();
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.22, audioContext.currentTime + 0.6);
  gainNode.gain.linearRampToValueAtTime(0.18, audioContext.currentTime + 1.2);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);

  source.connect(lowPass);
  lowPass.connect(gainNode);
  gainNode.connect(audioContext.destination);

  source.start();
  source.stop(audioContext.currentTime + duration);
}

const dysfunctionShortNames: Record<string, string> = {
  "Catastrophizing": "Catastrophizing",
  "Mind reading": "Mind reading",
  "Overgeneralization": "Overgeneralization",
  "All-or-nothing thinking": "All-or-nothing thinking",
  "Emotional reasoning": "Emotional reasoning",
  "Personalization": "Personalization",
  "Should statements": "Should statements",
  "Labeling": "Labeling",
  "Mental filter": "Mental filter",
  "Fortune telling": "Fortune telling",
  "Magnification/minimization": "Magnification/minimization",
};

const focusLabels: Record<string, string> = {
  memory: "Bad Memory",
  thought: "Bad Thought",
  experience: "Bad Experience",
  anxiety: "Anxiety",
};

const placeholderExamples: Record<string, string> = {
  memory: "Feeling guilty because said wrong things to the kid",
  thought: "I keep thinking I'm not good enough for this job",
  experience: "That argument at dinner keeps replaying in my mind",
  anxiety: "Worrying about what might go wrong tomorrow",
};

const advocacyExamples: Record<string, string> = {
  memory: "I just said to the kid, that he made wrong decision. Kids education - it's parent's duty. My duty",
  thought: "Everyone has negative thoughts sometimes. This thought doesn't define who I am",
  experience: "I handled a difficult situation the best I could with what I knew at the time",
  anxiety: "I have dealt with challenges before and I can handle what comes next",
};

export default function FocusDetail() {
  const [, params] = useRoute("/focus/:id");
  const [, setLocation] = useLocation();
  const focusId = params?.id || "memory";
  const [text, setText] = useState("");
  const [advocacyText, setAdvocacyText] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [showVictory, setShowVictory] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [noDistortion, setNoDistortion] = useState(false);
  const nameItRef = useRef<HTMLTextAreaElement>(null);
  const advocacyRef = useRef<HTMLTextAreaElement>(null);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [selfHarmAlert, setSelfHarmAlert] = useState<DetectionResult | null>(null);

  const autoResize = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    // Set to 1px first so scrollHeight reflects actual content height (not rows attribute),
    // then expand to that height so all content is visible without a scrollbar.
    el.style.height = "1px";
    el.style.height = el.scrollHeight + "px";
  }, []);

  // Resize on mount so initial height matches rows=3
  useEffect(() => {
    autoResize(nameItRef.current);
    autoResize(advocacyRef.current);
  }, [autoResize]);

  // Resize whenever values change — useLayoutEffect fires synchronously after DOM update
  // so the height is always measured correctly, including after AI fills the advocacy text
  useLayoutEffect(() => { autoResize(nameItRef.current); }, [text, autoResize]);
  useLayoutEffect(() => { autoResize(advocacyRef.current); }, [advocacyText, autoResize]);

  // Debounced self-harm detection on every keystroke in "Name It"
  useEffect(() => {
    if (!text.trim()) return;
    const timeout = setTimeout(() => {
      const result = detectSelfHarm(text);
      if (result.riskLevel !== "none") {
        setSelfHarmAlert(result);
      }
    }, 800);
    return () => clearTimeout(timeout);
  }, [text]);

  useEffect(() => {
    fetch("/api/subscription/details", { headers: { "X-Device-Id": getDeviceId() } })
      .then(res => res.json())
      .then(data => setHasSubscription(!!data.hasSubscription))
      .catch(() => {});
  }, []);

  const saveWin = useMutation({
    mutationFn: async () => {
      const existingWins = JSON.parse(localStorage.getItem("cbt_wins") || "[]");

      const deviceId = getDeviceId();
      const subRes = await fetch("/api/subscription/details", {
        headers: { "X-Device-Id": deviceId },
      });
      const sub = await subRes.json();
      const hasSubscription = sub.hasSubscription;

      const win = {
        id: crypto.randomUUID(),
        focusArea: noDistortion ? "I'm a Human!" : (focusLabels[focusId] || focusId),
        nameIt: text,
        dysfunctions: selected,
        advocacy: advocacyText,
        createdAt: new Date().toISOString(),
      };
      existingWins.unshift(win);
      localStorage.setItem("cbt_wins", JSON.stringify(existingWins));

      // Save win to DB — server recalculates totalWins, activeDays, and patterns
      await fetch("/api/user/win", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Device-Id": deviceId },
        body: JSON.stringify({
          focusArea: win.focusArea,
          nameIt: win.nameIt,
          dysfunctions: win.dysfunctions,
          advocacy: win.advocacy,
          createdAt: win.createdAt,
        }),
      }).catch(() => {});

      return { win, hasSubscription, newTotalWins: existingWins.length };
    },
    onSuccess: (data) => {
      if (!data) return;
      const { hasSubscription, newTotalWins } = data;
      playWinSound();
      setShowVictory(true);
      setTimeout(() => {
        setShowVictory(false);
        // First 5 wins are free. After that, prompt on win 6, 8, 10, 12… (every 2nd win)
        const shouldPrompt = !hasSubscription && newTotalWins > 5 && (newTotalWins - 6) % 2 === 0;
        setLocation(shouldPrompt ? "/subscribe" : "/insights");
      }, 2000);
    },
  });

  const analyzeDistortions = async () => {
    if (!text.trim() || text.trim().length < 3) return;

    // Safety check — if self-harm risk detected, block AI and show alert
    const safetyResult = detectSelfHarm(text);
    if (safetyResult.riskLevel !== "none") {
      setSelfHarmAlert(safetyResult);
      return;
    }

    setAnalyzing(true);
    setNoDistortion(false);
    try {
      const deviceId = getDeviceId();
      const res = await fetch("/api/analyze-distortions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Device-Id": deviceId },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.distortions && data.distortions.length > 0) {
        setSelected(data.distortions);
        setNoDistortion(false);
        const combinedFacts = [data.explanation, data.reframe]
          .filter(Boolean)
          .join("\n\n");
        if (combinedFacts) setAdvocacyText(combinedFacts);
      } else {
        setSelected([]);
        setNoDistortion(true);
        if (data.noDistortionComment) setAdvocacyText(data.noDistortionComment);
      }
    } catch (err) {
      console.error("Failed to analyze distortions:", err);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {selfHarmAlert && selfHarmAlert.riskLevel !== "none" && (
          <SelfHarmAlert
            riskLevel={selfHarmAlert.riskLevel as Exclude<RiskLevel, "none">}
            message={selfHarmAlert.message}
            onClose={() => setSelfHarmAlert(null)}
          />
        )}

        {showVictory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="w-32 h-32 bg-amber-400 rounded-full flex items-center justify-center shadow-2xl shadow-amber-400/50">
                <Trophy size={64} className="text-white" />
              </div>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-white text-3xl font-serif font-medium"
              >
                Victory!
              </motion.p>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-white/70 text-sm"
              >
                You let it go. Well done.
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Layout>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/")}
              data-testid="button-back"
              className="p-2 -ml-2 hover:bg-black/5 rounded-full transition-colors"
            >
              <ArrowLeft size={20} className="text-muted-foreground" />
            </button>
            <h1 className="font-serif text-3xl text-foreground font-medium">
              {focusLabels[focusId] || "Focus"}
            </h1>
          </div>

          <div className="space-y-1">
            <h2 className="text-base font-bold uppercase tracking-widest text-primary">Name It</h2>
            <div className="glass-card rounded-2xl p-4">
              <textarea
                ref={nameItRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onInput={(e) => autoResize(e.currentTarget)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); analyzeDistortions(); } }}
                placeholder={placeholderExamples[focusId] || "Describe what you're feeling..."}
                data-testid="input-name-it"
                rows={3}
                className="w-full bg-transparent border-none resize-none focus:ring-0 focus:outline-none text-xl leading-relaxed font-sans placeholder:text-muted-foreground/40 overflow-hidden"
              />
            </div>
            <div className="flex justify-end pt-1">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => analyzeDistortions()}
                disabled={analyzing || !text.trim()}
                data-testid="button-analyze"
                className="flex items-center gap-2 bg-[#4CFF00] text-black px-5 py-2 rounded-full font-medium text-base shadow-md transition-all disabled:opacity-40"
              >
                {analyzing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <span>Analyze it</span>
                )}
              </motion.button>
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-base font-bold uppercase tracking-widest text-primary">Distortion?</h2>
            <div className="glass-card rounded-2xl p-4">
              {analyzing ? (
                <p className="text-lg text-muted-foreground/50 font-sans">Analyzing your thought...</p>
              ) : noDistortion ? (
                <motion.p
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-lg text-green-600 font-medium font-sans"
                >
                  You are human — no cognitive distortions detected here 🌿
                </motion.p>
              ) : selected.length === 0 ? (
                <p className="text-lg text-muted-foreground/50 font-sans">
                  Describe your thought above and tap "Analyze it"
                </p>
              ) : (
                <div className="space-y-2">
                  {selected.map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-start gap-2"
                    >
                      <X size={18} className="text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-lg text-foreground font-medium leading-snug">
                        {dysfunctionShortNames[item] || item}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-base font-bold uppercase tracking-widest text-primary">Facts and Self Advocacy</h2>
            <div className="glass-card rounded-2xl p-4">
              <textarea
                ref={advocacyRef}
                value={advocacyText}
                onChange={(e) => setAdvocacyText(e.target.value)}
                onInput={(e) => autoResize(e.currentTarget)}
                placeholder={advocacyExamples[focusId] || "State the facts and advocate for yourself..."}
                data-testid="input-advocacy"
                rows={3}
                style={{ fieldSizing: "content" } as React.CSSProperties}
                className="w-full bg-transparent border-none resize-none focus:ring-0 focus:outline-none text-lg leading-relaxed font-sans placeholder:text-muted-foreground/40 overflow-hidden"
              />
            </div>
          </div>

          <AnimatePresence>
            {errors.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-1"
              >
                {errors.map((err, i) => (
                  <p key={i} className="text-sm text-red-500 font-medium">{err}</p>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-end pb-4">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const newErrors: string[] = [];
                if (!text.trim()) newErrors.push("Please fill in the \"Name It\" section.");
                if (selected.length === 0 && !noDistortion) newErrors.push("Please analyze your thought first using the \"Analyze it\" button.");
                if (!advocacyText.trim()) newErrors.push("Please fill in the \"Facts and Self Advocacy\" section.");
                setErrors(newErrors);
                if (newErrors.length > 0) return;
                navigator.vibrate?.([150, 100, 150]);
                saveWin.mutate();
              }}
              disabled={saveWin.isPending}
              data-testid="button-slide-it"
              className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-full font-medium shadow-lg hover:shadow-primary/20 transition-all"
            >
              <span className="text-xl">😌</span>
              <span>{saveWin.isPending ? "Flying..." : "Let It Go!"}</span>
            </motion.button>
          </div>
        </motion.div>
      </Layout>
    </>
  );
}