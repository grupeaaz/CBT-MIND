import Layout from "@/components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import { useRoute, useLocation } from "wouter";
import { useState } from "react";
import { ChevronDown, Check, ArrowLeft, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getDeviceId } from "@/lib/queryClient";

const dysfunctions = [
  "All or nothing",
  "Generalization",
  "Mental filter - only negative details are filtered",
  "Devaluing positive things",
  "Jumping to conclusions (mind reading and predicting the future)",
  "Overemphasizing and underemphasizing (I overemphasize my mistakes, I underemphasize my strengths)",
  "Emotional thinking - I rely on emotions as facts (I feel guilty - it means I did something wrong, I feel stupid - it means I did something stupid)",
  'Thinking "I should", "I must", "I should/could have"',
  "Labeling and mislabeling",
  "Personalization - I tend to take responsibility for everything, even though I have nothing to do with it",
];

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [showVictory, setShowVictory] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const saveWin = useMutation({
    mutationFn: async () => {
      const deviceId = getDeviceId();
      const res = await fetch("/api/wins", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Device-Id": deviceId },
        body: JSON.stringify({
          focusArea: focusLabels[focusId] || focusId,
          nameIt: text,
          dysfunctions: selected,
          advocacy: advocacyText,
        }),
      });
      if (res.status === 403) {
        const data = await res.json();
        if (data.requiresSubscription) {
          setLocation("/subscribe");
          return null;
        }
      }
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
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

  const toggleOption = (option: string) => {
    setSelected((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
    );
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
            <h2 className="text-sm font-bold uppercase tracking-widest text-primary">Name It</h2>
            <div className="glass-card rounded-2xl p-4">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={placeholderExamples[focusId] || "Describe what you're feeling..."}
                data-testid="input-name-it"
                className="w-full bg-transparent border-none resize-none focus:ring-0 focus:outline-none text-base leading-relaxed font-sans placeholder:text-muted-foreground/40 min-h-[60px]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-sm font-bold uppercase tracking-widest text-primary">Disfunction</h2>
            <div className="glass-card rounded-2xl overflow-hidden">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                data-testid="button-disfunction-menu"
                className="w-full flex items-center justify-between p-4 hover:bg-white/30 transition-colors"
              >
                <span className="text-lg font-medium text-foreground/80">
                  {selected.length === 0
                    ? "Select cognitive distortions..."
                    : `${selected.length} selected`}
                </span>
                <ChevronDown
                  size={20}
                  className={cn(
                    "text-muted-foreground transition-transform duration-300",
                    menuOpen && "rotate-180"
                  )}
                />
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border/50 max-h-[250px] overflow-y-auto">
                      {dysfunctions.map((item, i) => {
                        const isSelected = selected.includes(item);
                        return (
                          <button
                            key={i}
                            onClick={() => toggleOption(item)}
                            data-testid={`disfunction-option-${i}`}
                            className={cn(
                              "w-full flex items-start gap-3 px-5 py-4 text-left transition-colors border-b border-border/30 last:border-b-0",
                              isSelected ? "bg-primary/10" : "hover:bg-white/30"
                            )}
                          >
                            <div
                              className={cn(
                                "mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all",
                                isSelected
                                  ? "bg-primary border-primary"
                                  : "border-muted-foreground/30"
                              )}
                            >
                              {isSelected && <Check size={14} className="text-white" />}
                            </div>
                            <span
                              className={cn(
                                "text-base leading-relaxed",
                                isSelected ? "text-foreground font-medium" : "text-foreground/70"
                              )}
                            >
                              {item}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {selected.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap gap-2 pt-2"
              >
                {selected.map((item, i) => (
                  <span
                    key={i}
                    className="text-sm bg-primary/15 text-primary px-3 py-1.5 rounded-full font-medium"
                  >
                    {item.split(" - ")[0].split(" (")[0]}
                  </span>
                ))}
              </motion.div>
            )}
          </div>

          <div className="space-y-1">
            <h2 className="text-sm font-bold uppercase tracking-widest text-primary">Facts and Self Advocacy</h2>
            <div className="glass-card rounded-2xl p-4">
              <textarea
                value={advocacyText}
                onChange={(e) => setAdvocacyText(e.target.value)}
                placeholder={advocacyExamples[focusId] || "State the facts and advocate for yourself..."}
                data-testid="input-advocacy"
                className="w-full bg-transparent border-none resize-none focus:ring-0 focus:outline-none text-base leading-relaxed font-sans placeholder:text-muted-foreground/40 min-h-[60px]"
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
                if (selected.length === 0) newErrors.push("Please select at least one disfunction.");
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