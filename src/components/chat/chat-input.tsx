import React, { useState, useRef, useEffect } from "react";
import { SendHorizontal, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  onSendMessage: (text: string, disappearAfterMs: number) => void;
  isConnected: boolean;
  onDisappearTimeChange?: (ms: number) => void;
}

const VANISH_OPTIONS = [
  { label: "Never", ms: 0 },
  { label: "5 min", ms: 300000 },
  { label: "1 min", ms: 60000 },
  { label: "30s", ms: 30000 },
  { label: "10s", ms: 10000 },
  { label: "3s", ms: 3000 },
];

export function ChatInput({ onSendMessage, isConnected, onDisappearTimeChange }: ChatInputProps) {
  const [text, setText] = useState("");
  const [disappearMs, setDisappearMs] = useState(0);
  const [showVanishPicker, setShowVanishPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.matchMedia("(pointer: coarse)").matches);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const handleVanishSelect = (ms: number) => {
    setDisappearMs(ms);
    setShowVanishPicker(false);
    onDisappearTimeChange?.(ms);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !isConnected) return;
    onSendMessage(trimmed, disappearMs);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isMobile) {
      e.preventDefault();
      handleSubmit();
    }
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [text]);

  const selectedLabel = VANISH_OPTIONS.find(o => o.ms === disappearMs)?.label ?? "3s";

  return (
    <div className="p-3 md:p-5 bg-background/80 backdrop-blur-xl border-t border-border mt-auto">
      <form onSubmit={handleSubmit} className="flex gap-2 max-w-4xl mx-auto items-end">
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isConnected ? "Type a message..." : "Connecting..."}
            disabled={!isConnected}
            rows={1}
            className="w-full bg-secondary border border-white/10 rounded-2xl py-3.5 pl-4 pr-4 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 resize-none transition-all disabled:opacity-50 min-h-[52px]"
          />
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowVanishPicker(v => !v)}
            title="Set vanish time"
            className="h-[52px] px-3 rounded-2xl bg-secondary border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all flex items-center gap-1.5 text-xs font-mono"
          >
            <Timer className="h-3.5 w-3.5" />
            <span>{selectedLabel}</span>
          </button>

          {showVanishPicker && (
            <div className="absolute bottom-full mb-2 right-0 bg-card border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 min-w-[110px]">
              <div className="px-3 py-2 border-b border-white/5">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">My messages vanish after</p>
              </div>
              {VANISH_OPTIONS.map(opt => (
                <button
                  key={opt.ms}
                  type="button"
                  onClick={() => handleVanishSelect(opt.ms)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/5 flex items-center justify-between ${disappearMs === opt.ms ? 'text-primary font-semibold' : 'text-foreground'}`}
                >
                  {opt.label}
                  {disappearMs === opt.ms && <span className="text-primary text-xs">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <Button
          type="submit"
          size="icon"
          disabled={!text.trim() || !isConnected}
          className="shrink-0 h-[52px] w-[52px] rounded-2xl"
        >
          <SendHorizontal className="h-5 w-5" />
        </Button>
      </form>
      <p className="text-center mt-1.5 text-[10px] text-muted-foreground/50">
        {isMobile
          ? disappearMs === 0
            ? "Tap send · messages disappear when you leave"
            : `Tap send · messages vanish after ${selectedLabel}`
          : disappearMs === 0
            ? "Enter to send · messages disappear when you leave the chat"
            : `Enter to send · messages vanish after ${selectedLabel}`}
      </p>
    </div>
  );
}
