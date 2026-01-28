import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, X, Undo2 } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning';

export interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration = 3000, action }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setIsVisible(true));

    const timer = setTimeout(() => {
      handleClose();
    }, action ? duration + 2000 : duration); // Extend duration if action exists

    return () => clearTimeout(timer);
  }, [duration, action]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleAction = () => {
    if (action) {
      action.onClick();
      handleClose();
    }
  };

  const bgColor = type === 'success' ? 'bg-green-600' : type === 'warning' ? 'bg-amber-500' : 'bg-red-600';
  const Icon = type === 'success' ? CheckCircle2 : type === 'warning' ? AlertTriangle : AlertCircle;

  return (
    <div
      className={`fixed bottom-6 left-1/2 z-[200] transform -translate-x-1/2 transition-all duration-300 ease-out ${
        isVisible && !isLeaving ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
      role="alert"
      aria-live="polite"
    >
      <div className={`${bgColor} text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[280px] max-w-[90vw]`}>
        <Icon className="w-5 h-5 flex-shrink-0" />
        <span className="font-medium flex-1 text-sm">{message}</span>
        {action && (
          <button
            onClick={handleAction}
            className="flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded transition-colors font-medium text-sm"
          >
            <Undo2 className="w-3.5 h-3.5" />
            {action.label}
          </button>
        )}
        <button
          onClick={handleClose}
          className="p-1 hover:bg-white/20 rounded transition-colors"
          aria-label="閉じる"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Toast manager types
export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  return (
    <>
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          style={{ bottom: `${24 + index * 80}px` }}
          className="fixed left-1/2 z-[200] transform -translate-x-1/2"
        >
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => onRemove(toast.id)}
            action={toast.action}
          />
        </div>
      ))}
    </>
  );
};

// Custom hook for toast management
export const useToast = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = (message: string, type: ToastType, action?: { label: string; onClick: () => void }) => {
    const id = `toast-${Date.now()}`;
    setToasts(prev => [...prev, { id, message, type, action }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return { toasts, showToast, removeToast };
};
