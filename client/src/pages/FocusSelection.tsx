import { cn } from "@/lib/utils";
import { Play } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import Layout from "@/components/Layout";

export default function FocusSelection() {
  const [, setLocation] = useLocation();

  const handleSelect = (id: string) => {
    setLocation(`/focus/${id}`);
  };

  const focusAreas = [
    { id: "memory", label: "Bad Memory", color: "bg-[#FFF0F0] text-[#FF4D4D] border-[#FFCCCC]" },
    { id: "thought", label: "Bad Thought", color: "bg-[#FFF9E6] text-[#FFB300] border-[#FFE599]" },
    { id: "experience", label: "Bad Experience", color: "bg-[#E6E6FF] text-[#4D4DFF] border-[#CCCCFF]" },
    { id: "anxiety", label: "Anxiety", color: "bg-[#E6FFFA] text-[#00BFA5] border-[#B2DFDB]" },
  ];

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="pt-4"
      >
        <div className="flex flex-col gap-6">
          {focusAreas.map((area, i) => (
            <motion.button
              key={area.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSelect(area.id)}
              data-testid={`focus-${area.id}`}
              className={cn(
                "flex items-center justify-between p-8 rounded-2xl border-2 transition-all group w-full text-left",
                area.color
              )}
            >
              <span className="text-xl font-bold tracking-tight">
                {i + 1}. {area.label}
              </span>
              <motion.div
                animate={{ x: [0, 5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Play size={24} fill="currentColor" />
              </motion.div>
            </motion.button>
          ))}
        </div>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-sm text-muted-foreground mt-16 font-medium tracking-wide"
        >
          SELECT TO BEGIN TRANSFORMATION
        </motion.p>
      </motion.div>
    </Layout>
  );
}