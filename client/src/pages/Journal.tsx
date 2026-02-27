import Layout from "@/components/Layout";
import { PenLine, Calendar, Check } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { getDeviceId } from "@/lib/queryClient";

const availableTags = ["Anxiety", "Peace", "Fear", "Gratitude", "Confusion", "Hope", "Sadness"];

export default function Journal() {
  const [content, setContent] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { data: entries = [] } = useQuery({
    queryKey: ["/api/journal"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/journal", { headers: { "X-Device-Id": getDeviceId() } });
        if (!res.ok) throw new Error("Failed to fetch");
        const serverEntries = await res.json();
        try { localStorage.setItem("cbt_journal", JSON.stringify(serverEntries)); } catch {}
        return serverEntries;
      } catch {
        try {
          return JSON.parse(localStorage.getItem("cbt_journal") || "[]");
        } catch { return []; }
      }
    },
  });

  const saveEntry = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Device-Id": getDeviceId() },
        body: JSON.stringify({ content, tags: selectedTags }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const savedEntry = await res.json();
      try {
        const stored = JSON.parse(localStorage.getItem("cbt_journal") || "[]");
        stored.unshift(savedEntry);
        localStorage.setItem("cbt_journal", JSON.stringify(stored));
      } catch {}
      return savedEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
      setContent("");
      setSelectedTags([]);
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
          <div className="space-y-4">
            {entries.map((entry: any) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-5 rounded-2xl"
                data-testid={`journal-entry-${entry.id}`}
              >
                <p className="text-xs text-muted-foreground mb-2">{formatDate(entry.date)}</p>
                <p className="text-sm text-foreground/80 font-medium leading-relaxed">{entry.content}</p>
                {entry.tags && entry.tags.length > 0 && (
                  <div className="flex gap-1.5 mt-3">
                    {entry.tags.map((tag: string) => (
                      <span key={tag} className="text-xs text-primary/60 bg-primary/5 px-2 py-0.5 rounded-full">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}