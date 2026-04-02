import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAppStore } from "@/store/use-app-store";

import Login from "@/pages/login";
import Chat from "@/pages/chat";
import AdminDashboard from "@/pages/admin";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function AppContent() {
  const username = useAppStore(state => state.username);
  if (!username) return <Login />;
  return <Chat />;
}

function App() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={base}>
          <Switch>
            <Route path="/admin" component={AdminDashboard} />
            <Route path="/" component={AppContent} />
            <Route component={NotFound} />
          </Switch>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
