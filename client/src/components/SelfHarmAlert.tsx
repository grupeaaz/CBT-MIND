import { Heart, Phone } from "lucide-react";
import type { RiskLevel } from "@/lib/selfHarmDetection";

interface SelfHarmAlertProps {
  riskLevel: Exclude<RiskLevel, "none">;
  message: string;
  onClose: () => void;
}

export default function SelfHarmAlert({ riskLevel, message, onClose }: SelfHarmAlertProps) {
  const isCritical = riskLevel === "critical";
  const isHigh = riskLevel === "high";

  const containerClass = isCritical
    ? "bg-red-50 border-2 border-red-300"
    : isHigh
    ? "bg-amber-50 border-2 border-amber-300"
    : "bg-blue-50 border-2 border-blue-200";

  const iconBgClass = isCritical
    ? "bg-red-100"
    : isHigh
    ? "bg-amber-100"
    : "bg-blue-100";

  const iconColorClass = isCritical
    ? "text-red-600"
    : isHigh
    ? "text-amber-600"
    : "text-blue-500";

  const headingColorClass = isCritical
    ? "text-red-700"
    : isHigh
    ? "text-amber-700"
    : "text-blue-700";

  const heading = isCritical
    ? "Please reach out for help"
    : isHigh
    ? "We're concerned about you"
    : "We hear you";

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
      <div className={`w-full max-w-sm rounded-3xl p-7 shadow-2xl ${containerClass}`}>

        <div className="flex justify-center mb-5">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${iconBgClass}`}>
            {isCritical
              ? <Phone size={30} className={iconColorClass} />
              : <Heart size={30} className={iconColorClass} />
            }
          </div>
        </div>

        <h2 className={`text-center font-serif text-xl font-bold mb-4 ${headingColorClass}`}>
          {heading}
        </h2>

        <p className="text-sm text-foreground leading-relaxed whitespace-pre-line text-center mb-7">
          {message}
        </p>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-2xl text-sm font-medium bg-white/80 hover:bg-white border border-black/10 transition-colors text-foreground"
        >
          Back to the app
        </button>
      </div>
    </div>
  );
}
