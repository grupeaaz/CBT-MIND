import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Quote } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const fallbackQuotes = [
  { text: "Realize deeply that the present moment is all you have.", author: "Eckhart Tolle", source: "The Power of Now" },
  { text: "You are not your mind.", author: "Eckhart Tolle", source: "The Power of Now" },
];

export default function QuoteCard() {
  const [index, setIndex] = useState(0);

  const { data: quotes } = useQuery({
    queryKey: ["/api/quotes"],
    queryFn: async () => {
      const res = await fetch("/api/quotes");
      if (!res.ok) throw new Error("Failed to fetch quotes");
      return res.json();
    },
  });

  const displayQuotes = quotes && quotes.length > 0 ? quotes : fallbackQuotes;

  const nextQuote = () => {
    setIndex((prev) => (prev + 1) % displayQuotes.length);
  };

  return (
    <div 
      onClick={nextQuote}
      data-testid="quote-card"
      className="glass-card p-8 rounded-3xl cursor-pointer hover:bg-white/40 transition-colors duration-500 group relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-6 opacity-10">
        <Quote size={64} />
      </div>
      
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative z-10"
        >
          <p className="font-serif text-2xl md:text-3xl leading-relaxed text-foreground/90 italic">
            "{displayQuotes[index]?.text}"
          </p>
          <div className="mt-6 flex items-center gap-3">
            <div className="h-px w-8 bg-primary/40"></div>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
              {displayQuotes[index]?.author}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
      
      <div className="absolute bottom-4 right-6 text-xs text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity">
        Tap for new wisdom
      </div>
    </div>
  );
}