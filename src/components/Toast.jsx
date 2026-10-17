// Small messages that drop in from the top ("Schedule change", "Saved", errors).
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { bouncy } from '../lib/motion';

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const show = useCallback(
    (toast) => {
      const id = nextId.current++;
      const item = typeof toast === 'string' ? { title: toast } : toast;
      setToasts((t) => [...t.slice(-2), { id, ...item }]);
      setTimeout(() => dismiss(id), item.tone === 'error' ? 6000 : item.body ? 4500 : 2200);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.button
              key={t.id}
              type="button"
              layout
              className={`toast ${t.tone === 'error' ? 'toast-error' : ''}`}
              initial={{ opacity: 0, y: -40, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -24, scale: 0.95, transition: { duration: 0.18 } }}
              transition={bouncy}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.6, bottom: 0.1 }}
              onDragEnd={(_, info) => info.offset.y < -20 && dismiss(t.id)}
              onClick={() => {
                if (t.href) window.location.hash = t.href;
                dismiss(t.id);
              }}
            >
              <strong>{t.title}</strong>
              {t.body && <span>{t.body}</span>}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
