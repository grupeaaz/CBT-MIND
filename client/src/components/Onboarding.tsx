import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

export default function Onboarding() {
  const [current, setCurrent] = useState(0);
  const [userName, setUserName] = useState("");
  const [, setLocation] = useLocation();

  const screens = [
    {
      id: 1,
      type: "text-list",
      bg: "bg-[#f5f2ed]",
      content: (
        <div className="flex flex-col items-center justify-center h-full px-8 text-center space-y-6">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-serif text-4xl md:text-5xl text-primary leading-tight"
          >
            Remove anxiety...
          </motion.h1>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="font-serif text-4xl md:text-5xl text-primary/80 leading-tight"
          >
            Remove bad memories...
          </motion.h1>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="font-serif text-4xl md:text-5xl text-primary/60 leading-tight"
          >
            Remove stress...
          </motion.h1>
        </div>
      )
    },
    {
      id: 2,
      type: "floating-blocks",
      bg: "bg-[#edf2f5]",
      content: (
        <div className="relative h-full w-full overflow-hidden flex flex-col items-center justify-center">
          <motion.div
            animate={{ 
              y: [0, -20, 0],
              rotate: [0, 2, 0]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="glass-card px-8 py-4 rounded-2xl mb-8 shadow-xl border-white/50"
          >
            <span className="font-medium text-lg text-primary">Cognitive Behaviour Therapy</span>
          </motion.div>
          
          <motion.div
            animate={{ 
              y: [0, 20, 0],
              rotate: [0, -2, 0]
            }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            className="glass-card px-8 py-4 rounded-2xl mb-8 shadow-xl border-white/50"
          >
            <span className="font-medium text-lg text-secondary-foreground">Religion teaching</span>
          </motion.div>
  
          <motion.div
            animate={{ 
              y: [0, -15, 0],
              x: [0, 10, 0]
            }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="glass-card px-8 py-4 rounded-2xl shadow-xl border-white/50"
          >
            <span className="font-medium text-lg text-accent-foreground">Philosophical teaching</span>
          </motion.div>
        </div>
      )
    },
    {
      id: 3,
      type: "final",
      bg: "bg-[#f5edf0]",
      content: (
        <div className="flex flex-col items-center justify-center h-full px-8 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6"
          >
            <div className="w-12 h-12 rounded-full bg-primary/20 animate-pulse" />
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-serif text-3xl text-foreground mb-4"
          >
            What's your name?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-muted-foreground mb-6 text-sm"
          >
            We'll use it to personalize your experience.
          </motion.p>
          <motion.input
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Your name"
            data-testid="input-user-name"
            className="w-full max-w-xs text-center text-lg border-b-2 border-primary/30 focus:border-primary bg-transparent outline-none py-2 mb-8 placeholder:text-muted-foreground/50"
          />
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              const name = userName.trim() || "Seeker";
              localStorage.setItem("userName", name);
              localStorage.setItem("hasSeenOnboarding", "true");
              setLocation("/");
            }}
            className="bg-primary text-primary-foreground px-10 py-4 rounded-full font-medium shadow-lg hover:shadow-primary/20 transition-all"
            data-testid="button-begin-journey"
          >
            Begin Journey
          </motion.button>
        </div>
      )
    }
  ];

  useEffect(() => {
    // Pre-navigation logic handled in onClick now
  }, [setLocation]);

  return (
    <div className={cn("fixed inset-0 z-[100] transition-colors duration-1000", screens[current].bg)}>
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="h-full w-full"
        >
          {screens[current].content}
        </motion.div>
      </AnimatePresence>

      <div className="fixed bottom-12 left-0 right-0 flex justify-center items-center gap-3">
        {screens.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={cn(
              "w-2.5 h-2.5 rounded-full transition-all duration-300",
              current === i ? "bg-primary w-8" : "bg-primary/20"
            )}
          />
        ))}
      </div>
    </div>
  );
}