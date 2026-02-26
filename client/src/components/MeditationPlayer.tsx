import { Play, Pause, SkipForward, Volume2 } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

export default function MeditationPlayer({ title = "Morning Presence", duration = "10:00" }) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="glass-card p-6 rounded-3xl mt-4">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-2xl bg-stone-200 overflow-hidden relative">
           <img src="/images/meditation-hero.png" className="w-full h-full object-cover opacity-80" alt="Meditation cover" />
        </div>
        <div>
          <h4 className="font-serif text-xl text-foreground">{title}</h4>
          <p className="text-muted-foreground text-sm">Guided • {duration}</p>
        </div>
      </div>

      <div className="w-full bg-black/5 h-1.5 rounded-full mb-6 overflow-hidden">
        <motion.div 
          className="h-full bg-primary"
          initial={{ width: "0%" }}
          animate={{ width: isPlaying ? "45%" : "0%" }}
          transition={{ duration: 10, ease: "linear" }}
        />
      </div>

      <div className="flex items-center justify-between px-4">
        <button className="text-muted-foreground hover:text-foreground transition-colors">
          <Volume2 size={20} />
        </button>
        
        <motion.button 
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsPlaying(!isPlaying)}
          className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors"
        >
          {isPlaying ? (
            <Pause size={28} fill="currentColor" className="opacity-90" />
          ) : (
            <Play size={28} fill="currentColor" className="ml-1 opacity-90" />
          )}
        </motion.button>
        
        <button className="text-muted-foreground hover:text-foreground transition-colors">
          <SkipForward size={20} />
        </button>
      </div>
    </div>
  );
}