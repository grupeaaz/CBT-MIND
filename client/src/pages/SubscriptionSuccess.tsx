import Layout from "@/components/Layout";
import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { getDeviceId } from "@/lib/queryClient";

export default function SubscriptionSuccess() {
  const [, setLocation] = useLocation();
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");

    if (sessionId) {
      const deviceId = getDeviceId();
      fetch("/api/stripe/verify-session", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Device-Id": getDeviceId() },
        body: JSON.stringify({ sessionId, deviceId }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.verified) {
            localStorage.setItem("subscribed", "true");
            setVerified(true);
          }
          setVerifying(false);
        })
        .catch(() => {
          setVerifying(false);
        });
    } else {
      setVerifying(false);
    }
  }, []);

  if (verifying) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
          <Loader2 size={48} className="text-primary animate-spin" />
          <p className="text-muted-foreground">Verifying your subscription...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
          className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center"
        >
          <Check size={48} className="text-emerald-500" />
        </motion.div>

        <div className="space-y-2">
          <h1 className="font-serif text-3xl text-foreground font-medium">
            {verified ? "Welcome!" : "Almost there!"}
          </h1>
          <p className="text-muted-foreground text-base max-w-xs mx-auto">
            {verified
              ? "Your free trial has started. You now have unlimited access to all healing tools."
              : "There was an issue verifying your subscription. Please try again."}
          </p>
        </div>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setLocation("/")}
          data-testid="button-continue-after-subscribe"
          className="bg-primary text-primary-foreground px-8 py-3 rounded-full font-medium shadow-lg"
        >
          Continue Healing
        </motion.button>
      </motion.div>
    </Layout>
  );
}
