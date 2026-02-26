import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Insights from "@/pages/Insights";
import Journal from "@/pages/Journal";
import Profile from "@/pages/Profile";
import Onboarding from "@/components/Onboarding";
import FocusSelection from "@/pages/FocusSelection";
import FocusDetail from "@/pages/FocusDetail";
import Wins from "@/pages/Wins";
import Subscribe from "@/pages/Subscribe";
import SubscriptionSuccess from "@/pages/SubscriptionSuccess";
import InstallPrompt from "@/components/InstallPrompt";
import { useState, useEffect } from "react";

function Router() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const hasSeen = localStorage.getItem("hasSeenOnboarding");
    if (!hasSeen && location !== "/") {
      setShowOnboarding(true);
    }
  }, [location]);

  if (showOnboarding && location !== "/") {
    return <Onboarding />;
  }

  return (
    <Switch>
      <Route path="/" component={FocusSelection} />
      <Route path="/focus/:id" component={FocusDetail} />
      <Route path="/wins" component={Wins} />
      <Route path="/subscribe" component={Subscribe} />
      <Route path="/subscription/success" component={SubscriptionSuccess} />
      <Route path="/subscription/cancel" component={FocusSelection} />
      <Route path="/insights" component={Insights} />
      <Route path="/practices">{() => <Redirect to="/insights" />}</Route>
      <Route path="/journal" component={Journal} />
      <Route path="/profile" component={Profile} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <Router />
      <InstallPrompt />
    </QueryClientProvider>
  );
}

export default App;