import { useState } from "react";
import { motion } from "framer-motion";
import { Sun, Cloud, CloudRain, CloudLightning, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

const moods = [
  { value: 1, icon: CloudLightning, label: "Stormy", color: "text-indigo-400" },
  { value: 2, icon: CloudRain, label: "Heavy", color: "text-blue-400" },
  { value: 3, icon: Cloud, label: "Cloudy", color: "text-slate-400" },
  { value: 4, icon: Sun, label: "Bright", color: "text-amber-400" },
  { value: 5, icon: Moon, label: "Peaceful", color: "text-emerald-400" },
];

export default function MoodTracker() {
  const [selected, setSelected] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSelect = (mood: typeof moods[number]) => {
    setSelected(mood.value);
    const entry = { value: mood.value, label: mood.label, date: new Date().toISOString() };
    const stored = JSON.parse(localStorage.getItem("cbt_moods") || "[]");
    stored.unshift(entry);
    localStorage.setItem("cbt_moods", JSON.stringify(stored));
    setSaved(true);
  };

  return (
    <div className="py-6">
      <h3 className="text-lg font-medium mb-4 text-center text-foreground/80">How is your spirit today?</h3>
      <div className="flex justify-between items-center px-2">
        {moods.map((mood) => {
          const isSelected = selected === mood.value;
          return (
            <motion.button
              key={mood.value}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleSelect(mood)}
              data-testid={`mood-${mood.label.toLowerCase()}`}
              className={cn(
                "flex flex-col items-center gap-2 p-2 rounded-2xl transition-all duration-300 relative",
                isSelected ? "bg-white shadow-lg -translate-y-2" : "hover:bg-white/50"
              )}
            >
              <div className={cn(
                "p-3 rounded-full transition-colors",
                isSelected ? "bg-background" : "bg-transparent",
                mood.color
              )}>
                <mood.icon size={24} strokeWidth={isSelected ? 2.5 : 1.5} />
              </div>
              <span className={cn(
                "text-xs font-medium transition-opacity",
                isSelected ? "opacity-100 text-foreground" : "opacity-0 absolute -bottom-4"
              )}>
                {mood.label}
              </span>
            </motion.button>
          );
        })}
      </div>
      {saved && selected && (
        <motion.p 
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-xs text-primary mt-4 font-medium"
        >
          Mood recorded. Be gentle with yourself.
        </motion.p>
      )}
    </div>
  );
}