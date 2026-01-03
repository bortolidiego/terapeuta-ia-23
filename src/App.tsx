import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import GlobalHeader from "@/components/GlobalHeader";
import AuthSessionManager from "@/components/AuthSessionManager";
import Index from "./pages/Index";

import Auth from "./pages/Auth";
import Security from "./pages/Security";
import NotFound from "./pages/NotFound";
import { Chat } from "./pages/Chat";
import { Profile } from "./pages/Profile";
import { Credits } from "./pages/Credits";
import { RegrasAudicao } from "./pages/RegrasAudicao";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthSessionManager />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <div className="min-h-screen flex flex-col">
                    <GlobalHeader />
                    <div className="flex-1">
                      <Index />
                    </div>
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat/:id?"
              element={
                <ProtectedRoute>
                  <div className="h-screen flex flex-col">
                    <GlobalHeader />
                    <div className="flex-1">
                      <Chat />
                    </div>
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <div className="min-h-screen flex flex-col">
                    <GlobalHeader />
                    <div className="flex-1">
                      <Profile />
                    </div>
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/credits"
              element={
                <ProtectedRoute>
                  <div className="min-h-screen flex flex-col">
                    <GlobalHeader />
                    <div className="flex-1">
                      <Credits />
                    </div>
                  </div>
                </ProtectedRoute>
              }
            />

            <Route
              path="/security"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <div className="min-h-screen flex flex-col">
                    <GlobalHeader />
                    <div className="flex-1">
                      <Security />
                    </div>
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/regras-audicao"
              element={
                <ProtectedRoute>
                  <div className="min-h-screen flex flex-col">
                    <GlobalHeader />
                    <div className="flex-1">
                      <RegrasAudicao />
                    </div>
                  </div>
                </ProtectedRoute>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
