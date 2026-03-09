import Layout from "@/components/Layout";
import { PenLine, Calendar, Check, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const availableTags = ["Anxiety", "Peace", "Fear", "Gratitude", "Confusion", "Hope", "Sadness"];

export default function Journal() {
  const [content, setContent] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const [entries, setEntries] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem("cbt_journal") || "[]"); } catch { return []; }
  });

  const saveEntry = useMutation({
    mutationFn: async () => {
      const entry = {
        id: crypto.randomUUID(),
        content,
        tags: selectedTags,
        date: new Date().toISOString(),
        aiReflection: null as string | null,
        reflectionLoading: true,
      };

      const stored = JSON.parse(localStorage.getItem("cbt_journal") || "[]");
      stored.unshift(entry);
      localStorage.setItem("cbt_journal", JSON.stringify(stored));

      return entry;
    },
    onSuccess: (entry) => {
      setEntries((prev) => [entry, ...prev]);
      setContent("");
      setSelectedTags([]);

      // Fetch AI reflection in background and update the entry when ready
      fetch("/api/journal/reflect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: entry.content }),
      })
        .then((res) => res.json())
        .then((data) => {
          const reflection = data.reflection || "";

          // Update in state
          setEntries((prev) =>
            prev.map((e) =>
              e.id === entry.id ? { ...e, aiReflection: reflection, reflectionLoading: false } : e
            )
          );

          // Persist reflection to localStorage
          const stored = JSON.parse(localStorage.getItem("cbt_journal") || "[]");
          const updated = stored.map((e: any) =>
            e.id === entry.id ? { ...e, aiReflection: reflection, reflectionLoading: false } : e
          );
          localStorage.setItem("cbt_journal", JSON.stringify(updated));
        })
        .catch(() => {
          setEntries((prev) =>
            prev.map((e) =>
              e.id === entry.id ? { ...e, reflectionLoading: false } : e
            )
          );
        });
    },
  });

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <Layout>
      <header className="mb-8">
        <h1 className="font-serif text-4xl text-foreground font-medium mb-2">Journal</h1>
        <p className="text-muted-foreground">Observe your thoughts without judgment.</p>
      </header>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-6 rounded-3xl min-h-[300px] flex flex-col"
      >
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/50">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar size={16} />
            <span className="text-sm font-medium">Today</span>
          </div>
          <button
            onClick={() => saveEntry.mutate()}
            disabled={!content.trim() || saveEntry.isPending}
            data-testid="button-save-journal"
            className={cn(
              "text-sm font-medium transition-colors flex items-center gap-1",
              content.trim() ? "text-primary hover:text-primary/80" : "text-muted-foreground/40"
            )}
          >
            {saveEntry.isPending ? "Saving..." : saveEntry.isSuccess ? (
              <><Check size={14} /> Saved</>
            ) : "Save Entry"}
          </button>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What is arising in your consciousness right now?"
          data-testid="input-journal-content"
          className="flex-1 w-full bg-transparent border-none resize-none focus:ring-0 focus:outline-none p-0 text-lg leading-relaxed font-sans placeholder:text-muted-foreground/50 min-h-[200px]"
        />

        <div className="mt-6 pt-4 border-t border-border/50 flex gap-2 overflow-x-auto pb-2">
          {availableTags.map(tag => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              data-testid={`tag-${tag.toLowerCase()}`}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs transition-all whitespace-nowrap",
                selectedTags.includes(tag)
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-white/50 border border-border text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/20"
              )}
            >
              #{tag}
            </button>
          ))}
        </div>
      </motion.div>

      {entries.length > 0 && (
        <div className="mt-8">
          <h3 className="font-serif text-2xl text-foreground mb-4">Past Reflections</h3>
          <div className="space-y-5">
            {entries.map((entry: any) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
                data-testid={`journal-entry-${entry.id}`}
              >
                {/* User's entry — right side */}
                <div className="flex justify-end">
                  <div className="max-w-[85%] bg-primary/10 border border-primary/15 rounded-3xl rounded-tr-md px-5 py-4">
                    <p className="text-xs text-primary/50 font-medium mb-1.5">{formatDate(entry.date)}</p>
                    <p className="text-base text-foreground/90 leading-relaxed">{entry.content}</p>
                    {entry.tags && entry.tags.length > 0 && (
                      <div className="flex gap-1.5 mt-3 flex-wrap">
                        {entry.tags.map((tag: string) => (
                          <span key={tag} className="text-xs text-primary/60 bg-primary/5 px-2 py-0.5 rounded-full">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* AI reflection — left side */}
                <AnimatePresence>
                  {entry.reflectionLoading && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-3 px-1"
                    >
                      <div className="w-7 h-7 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center flex-shrink-0 text-sm">
                        🌿
                      </div>
                      <div className="flex gap-1 items-center py-3 px-4 bg-amber-50 border border-amber-100 rounded-3xl rounded-tl-md">
                        <Loader2 size={13} className="animate-spin text-amber-400" />
                        <span className="text-xs text-amber-400 ml-1">Reflecting...</span>
                      </div>
                    </motion.div>
                  )}

                  {!entry.reflectionLoading && entry.aiReflection && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-3 px-1"
                    >
                      <div className="w-7 h-7 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center flex-shrink-0 text-sm mt-1">
                        🌿
                      </div>
                      <div className="max-w-[85%] bg-amber-50 border border-amber-100 rounded-3xl rounded-tl-md px-5 py-4">
                        <p className="text-xs text-amber-500 font-medium mb-1.5">Idea</p>
                        <p className="text-base text-foreground/80 leading-relaxed italic">{entry.aiReflection}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}
