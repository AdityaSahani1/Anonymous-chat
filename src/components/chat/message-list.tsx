import React, { useEffect, useRef, useCallback } from "react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquareDashed, Clock } from "lucide-react";
import { useAppStore } from "@/store/use-app-store";
import { ChatMessage } from "@/hooks/use-socket";
import { cn, getUsernameColorClasses, getInitials } from "@/lib/utils";

interface MessageListProps {
  messages: ChatMessage[];
  onMessageViewed?: (messageId: string, roomId: string) => void;
  senderDisappearMs?: number;
}

function MessageBubble({
  msg,
  isOwn,
  showHeader,
  onViewed,
  senderDisappearMs,
}: {
  msg: ChatMessage;
  isOwn: boolean;
  showHeader: boolean;
  onViewed: (id: string, roomId: string) => void;
  senderDisappearMs: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const hasCalledRef = useRef(false);
  const [senderCountdown, setSenderCountdown] = React.useState<number | null>(null);
  const [faded, setFaded] = React.useState(!!msg.deleted);

  useEffect(() => {
    if (msg.deleted) setFaded(true);
  }, [msg.deleted]);

  useEffect(() => {
    if (!isOwn || faded || msg.deleted) return;
    if (senderDisappearMs <= 0) return;

    const total = senderDisappearMs;
    const start = Date.now();

    const countInterval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.ceil((total - elapsed) / 1000);
      if (remaining > 0 && remaining <= 5) {
        setSenderCountdown(remaining);
      } else if (remaining <= 0) {
        setSenderCountdown(null);
        clearInterval(countInterval);
      }
    }, 200);

    const fadeTimer = setTimeout(() => {
      setFaded(true);
      setSenderCountdown(null);
    }, senderDisappearMs);

    return () => {
      clearTimeout(fadeTimer);
      clearInterval(countInterval);
    };
  }, [isOwn, senderDisappearMs, faded, msg.deleted]);

  useEffect(() => {
    if (isOwn || hasCalledRef.current || faded || msg.deleted) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasCalledRef.current) {
          hasCalledRef.current = true;
          onViewed(msg.id, msg.roomId);
          observer.disconnect();
        }
      },
      { threshold: 0.8 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isOwn, msg.id, msg.roomId, onViewed, faded, msg.deleted]);

  const colorClasses = getUsernameColorClasses(msg.username);
  const isFaded = faded || !!msg.deleted;

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: isFaded ? 0 : 1, y: 0, scale: isFaded ? 0.92 : 1 }}
      exit={{ opacity: 0, scale: 0.88, y: -4 }}
      transition={{ type: "spring", stiffness: 380, damping: 28, opacity: { duration: 0.5 } }}
      className={cn(
        "flex gap-3 max-w-[85%] md:max-w-[70%]",
        isOwn ? "ml-auto flex-row-reverse" : "mr-auto",
        isFaded && "pointer-events-none"
      )}
    >
      {!isOwn && (
        <div className="shrink-0 w-8">
          {showHeader ? (
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-md",
              colorClasses
            )}>
              {getInitials(msg.username)}
            </div>
          ) : null}
        </div>
      )}

      <div className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}>
        {showHeader && !isOwn && (
          <div className="flex items-baseline gap-2 mb-1.5 ml-1">
            <span className={cn("text-xs font-semibold", colorClasses.split(' ')[0])}>
              {msg.username}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {format(msg.timestamp, "h:mm a")}
            </span>
          </div>
        )}
        {showHeader && isOwn && (
          <div className="flex items-baseline gap-2 mb-1.5 mr-1">
            <span className="text-[10px] text-muted-foreground">
              {format(msg.timestamp, "h:mm a")}
            </span>
          </div>
        )}

        <div className={cn(
          "px-4 py-2.5 rounded-2xl text-[15px] leading-relaxed shadow-sm whitespace-pre-wrap break-words relative",
          isOwn
            ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-tr-sm"
            : "bg-secondary border border-white/5 text-secondary-foreground rounded-tl-sm"
        )}>
          {isFaded ? (
            <span className="italic opacity-40 text-sm">Message faded away</span>
          ) : msg.text}

          {isOwn && senderCountdown !== null && !isFaded && (
            <span className="absolute -bottom-5 right-0 flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />
              {senderCountdown}s
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function MessageList({ messages, onMessageViewed, senderDisappearMs = 3000 }: MessageListProps) {
  const { username } = useAppStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleViewed = useCallback((id: string, roomId: string) => {
    onMessageViewed?.(id, roomId);
  }, [onMessageViewed]);

  if (!messages || messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-700">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
          <MessageSquareDashed className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">It's quiet here...</h3>
        <p className="text-muted-foreground max-w-sm">
          Be the first to say hello and start the conversation!
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
      <AnimatePresence initial={false}>
        {messages.map((msg, index) => {
          const isOwn = msg.username === username;
          const showHeader = index === 0 || messages[index - 1].username !== msg.username;
          return (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isOwn={isOwn}
              showHeader={showHeader}
              onViewed={handleViewed}
              senderDisappearMs={senderDisappearMs}
            />
          );
        })}
      </AnimatePresence>
      <div ref={bottomRef} className="h-1" />
    </div>
  );
}
