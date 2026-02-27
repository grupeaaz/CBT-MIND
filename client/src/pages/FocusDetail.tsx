import Layout from "@/components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import { useRoute, useLocation } from "wouter";
import { useState, useRef, useEffect, useCallback } from "react";
import { X, ArrowLeft, Trophy, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getDeviceId } from "@/lib/queryClient";

const dysfunctionShortNames: Record<string, string> = {
  "All or nothing": "All or nothing",
  "Generalization": "Generalization",
  "Mental filter - only negative details are filtered": "Mental filter",
  "Devaluing positive things": "Devaluing positive things",
  "Jumping to conclusions (mind reading and predicting the future)": "Jumping to conclusions",
  "Overemphasizing and underemphasizing (I overemphasize my mistakes, I underemphasize my strengths)": "Overemphasizing and underemphasizing",
  "Emotional thinking - I rely on emotions as facts (I feel guilty - it means I did something wrong, I feel stupid - it means I did something stupid)": "Emotional thinking",
  'Thinking "I should", "I must", "I should/could have"': 'Thinking "I should"',
  "Labeling and mislabeling": "Labeling and mislabeling",
  "Personalization - I tend to take responsibility for everything, even though I have nothing to do with it": "Personalization",
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
  const [noDistortionMsg, setNoDistortionMsg] = useState("");
  const queryClient = useQueryClient();
  const nameItRef = useRef<HTMLTextAreaElement>(null);
  const advocacyRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, []);

  useEffect(() => { autoResize(nameItRef.current); }, [text, autoResize]);
  useEffect(() => { autoResize(advocacyRef.current); }, [advocacyText, autoResize]);

  const saveWin = useMutation({
    mutationFn: async () => {
      const deviceId = getDeviceId();
      const winData = {
        focusArea: noDistortion ? "I'm a Human!" : (focusLabels[focusId] || focusId),
        nameIt: text,
        dysfunctions: selected,
        advocacy: advocacyText,
      };
      const res = await fetch("/api/wins", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Device-Id": deviceId },
        body: JSON.stringify(winData),
      });
      if (res.status === 403) {
        const data = await res.json();
        if (data.requiresSubscription) {
          setLocation("/subscribe");
          return null;
        }
      }
      if (!res.ok) throw new Error("Failed to save");
      const savedWin = await res.json();
      try {
        const stored = JSON.parse(localStorage.getItem("cbt_wins") || "[]");
        stored.unshift(savedWin);
        localStorage.setItem("cbt_wins", JSON.stringify(stored));
      } catch {}
      return savedWin;
    },
    onSuccess: (data) => {
      if (!data) return;
      queryClient.invalidateQueries({ queryKey: ["/api/wins"] });
      setShowVictory(true);
      setTimeout(() => {
        setShowVictory(false);
        setLocation("/wins");
      }, 2000);
    },
  });

  const analyzeDistortions = async () => {
    if (!text.trim() || text.trim().length < 3) return;
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
      } else {
        setSelected([]);
        setNoDistortion(true);
        setNoDistortionMsg(data.noDistortionMessage || "You are the human! No distortion here :)");
      }
      if (data.advocacy) {
        setAdvocacyText(data.advocacy);
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
                You let it slide. Well done.
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
                placeholder={placeholderExamples[focusId] || "Describe what you're feeling..."}
                data-testid="input-name-it"
                rows={3}
                className="w-full bg-transparent border-none resize-none focus:ring-0 focus:outline-none text-lg leading-relaxed font-sans placeholder:text-muted-foreground/40 overflow-hidden"
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
            <h2 className="text-base font-bold uppercase tracking-widest text-primary">Disfunction</h2>
            <div className="glass-card rounded-2xl p-4">
              {analyzing ? (
                <p className="text-lg text-muted-foreground/50 font-sans">Analyzing your thought...</p>
              ) : noDistortion ? (
                <motion.p
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-lg text-green-600 font-medium font-sans"
                >
                  {noDistortionMsg}
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
                placeholder={advocacyExamples[focusId] || "State the facts and advocate for yourself..."}
                data-testid="input-advocacy"
                rows={1}
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
                saveWin.mutate();
              }}
              disabled={saveWin.isPending}
              data-testid="button-slide-it"
              className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-full font-medium shadow-lg hover:shadow-primary/20 transition-all"
            >
              <span className="text-xl">😌</span>
              <span>{saveWin.isPending ? "Saving..." : "Let It Slide!"}</span>
            </motion.button>
          </div>
        </motion.div>
      </Layout>
    </>
  );
}