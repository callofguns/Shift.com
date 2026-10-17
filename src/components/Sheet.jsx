// A panel that springs up from the bottom of the screen. Drag the handle down
// (or tap outside, or press Escape) to close it.
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls } from 'motion/react';
import { spring } from '../lib/motion';
import Icon from './Icon';

export default function Sheet({ open, onClose, title, children, footer }) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <SheetBody onClose={onClose} title={title} footer={footer}>
          {children}
        </SheetBody>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function SheetBody({ onClose, title, footer, children }) {
  const controls = useDragControls();
  const panel = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const previous = document.activeElement;
    panel.current?.focus();
    document.body.classList.add('sheet-open');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('sheet-open');
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="sheet-layer">
      <motion.div
        className="sheet-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        ref={panel}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={spring}
        drag="y"
        dragControls={controls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.05, bottom: 0.9 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 110 || info.velocity.y > 600) onClose();
        }}
      >
        <div className="sheet-grab" onPointerDown={(e) => controls.start(e)}>
          <span className="sheet-handle" />
          <div className="sheet-head">
            <h2>{title}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <Icon name="close" size={20} />
            </button>
          </div>
        </div>
        <div className="sheet-content">{children}</div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </motion.div>
    </div>
  );
}
