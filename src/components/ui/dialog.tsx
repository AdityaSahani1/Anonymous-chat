import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({ isOpen, onClose, title, description, children, className }: DialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
              className={cn(
                "w-full max-w-md pointer-events-auto bg-card border border-white/10 shadow-2xl rounded-2xl p-6 relative overflow-hidden",
                className
              )}
            >
              <button
                onClick={onClose}
                className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
              
              <div className="mb-6">
                <h2 className="text-xl font-display font-semibold tracking-tight">{title}</h2>
                {description && <p className="text-sm text-muted-foreground mt-1.5">{description}</p>}
              </div>
              
              {children}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
