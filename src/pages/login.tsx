import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/store/use-app-store";
import { useLocation } from "wouter";

type Step = "nickname" | "admin-password";

export default function Login() {
  const [name, setName] = useState("");
  const [step, setStep] = useState<Step>("nickname");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const setUsername = useAppStore(state => state.setUsername);
  const [, navigate] = useLocation();

  const isAdminIntent = name.trim() === "/admin";

  const handleNicknameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAdminIntent) {
      setStep("admin-password");
      return;
    }
    if (name.trim().length >= 2) {
      setUsername(name.trim());
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await fetch("/api/chat/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: adminPassword.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        sessionStorage.setItem("adminToken", adminPassword.trim());
        navigate("/admin");
      } else {
        setAuthError("Wrong password or token. Try again.");
      }
    } catch {
      setAuthError("Connection error. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-background">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <img
          src={`${import.meta.env.BASE_URL}images/login-bg.png`}
          alt="Background"
          className="w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px]" />
        <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-background to-transparent" />
        <div className="absolute bottom-0 inset-x-0 h-64 bg-gradient-to-t from-background to-transparent" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="w-full max-w-md z-10 px-6"
      >
        <div className="glass-panel p-8 md:p-10 rounded-3xl text-center relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl" />

          <div className="relative z-10">
            <AnimatePresence mode="wait">
              {step === "nickname" ? (
                <motion.div
                  key="nickname"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                  <h1 className="text-3xl font-bold text-white mb-2">Join the Cosmos</h1>
                  <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
                    Enter a realm of anonymous real-time chat. No accounts, no tracing. Just pure connection.
                  </p>

                  <form onSubmit={handleNicknameSubmit} className="space-y-4">
                    <Input
                      autoFocus
                      placeholder="Enter a cool nickname..."
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={20}
                      className="h-14 bg-black/40 border-white/10 text-lg placeholder:text-white/30 text-center"
                    />
                    <Button
                      type="submit"
                      size="lg"
                      className="w-full h-14 text-base gap-2 rounded-xl"
                      disabled={isAdminIntent ? false : name.trim().length < 2}
                      variant={isAdminIntent ? "secondary" : "default"}
                    >
                      {isAdminIntent ? (
                        <><ShieldCheck className="h-5 w-5" /> Admin Access</>
                      ) : (
                        <>Enter Chat <ArrowRight className="h-5 w-5" /></>
                      )}
                    </Button>
                  </form>
                </motion.div>
              ) : (
                <motion.div
                  key="admin-password"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <ShieldCheck className="h-8 w-8 text-indigo-400" />
                  </div>
                  <h1 className="text-3xl font-bold text-white mb-2">Admin Access</h1>
                  <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
                    Enter your admin password or the server token from startup logs.
                  </p>

                  <form onSubmit={handleAdminSubmit} className="space-y-4">
                    <div className="relative">
                      <Input
                        autoFocus
                        type={showPassword ? "text" : "password"}
                        placeholder="Password or token..."
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        className="h-14 bg-black/40 border-white/10 text-lg placeholder:text-white/30 text-center pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(s => !s)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    {authError && (
                      <p className="text-sm text-destructive font-medium">{authError}</p>
                    )}

                    <Button
                      type="submit"
                      size="lg"
                      className="w-full h-14 text-base gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500"
                      disabled={authLoading || !adminPassword.trim()}
                    >
                      {authLoading ? "Verifying..." : <><ShieldCheck className="h-5 w-5" /> Enter Admin Panel</>}
                    </Button>

                    <button
                      type="button"
                      onClick={() => { setStep("nickname"); setAuthError(""); setAdminPassword(""); }}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      ← Back to chat login
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <p className="text-center text-xs text-white/30 mt-8">
          {step === "nickname" ? "By joining, you agree to be respectful to others." : "Admin session is private and not visible to users."}
        </p>
      </motion.div>
    </div>
  );
}
