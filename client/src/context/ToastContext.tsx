import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
  remove: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
      remove(id);
    }, 4000);
  }, [remove]);

  const success = useCallback((msg: string) => add(msg, 'success'), [add]);
  const error = useCallback((msg: string) => add(msg, 'error'), [add]);
  const warning = useCallback((msg: string) => add(msg, 'warning'), [add]);
  const info = useCallback((msg: string) => add(msg, 'info'), [add]);

  return (
    <ToastContext.Provider value={{ success, error, warning, info, remove }}>
      {children}
      
      {/* Toast Overlay Container */}
      <div style={styles.toastContainer}>
        {toasts.map((toast) => {
          const typeStyles = styles[toast.type];
          const Icon = typeStyles.icon;

          return (
            <div 
              key={toast.id} 
              className="glass-card toast-slide-in"
              style={{
                ...styles.toastCard,
                borderColor: typeStyles.borderColor,
                boxShadow: typeStyles.boxShadow,
              }}
            >
              <div style={styles.iconContainer}>
                <Icon size={18} color={typeStyles.color} />
              </div>
              <div style={styles.messageText}>
                {toast.message}
              </div>
              <button 
                style={styles.closeBtn} 
                onClick={() => remove(toast.id)}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Injection of animations into head dynamically
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes toastSlideIn {
      from { transform: translateX(120%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    .toast-slide-in {
      animation: toastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
  `;
  document.head.appendChild(style);
}

const styles = {
  toastContainer: {
    position: 'fixed' as const,
    top: '20px',
    right: '20px',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
    maxWidth: '350px',
    width: '100%',
    pointerEvents: 'none' as const,
  },
  toastCard: {
    pointerEvents: 'auto' as const,
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.85rem 1rem',
    background: 'hsla(222, 47%, 12%, 0.85)',
    backdropFilter: 'blur(12px)',
    border: '1px solid transparent',
    borderRadius: '12px',
  },
  iconContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageText: {
    flex: 1,
    fontSize: '0.85rem',
    fontWeight: 500,
    color: '#fff',
    lineHeight: 1.4,
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.4)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.2rem',
    borderRadius: '4px',
    transition: 'color 0.2s',
  },
  success: {
    icon: CheckCircle2,
    color: 'hsl(160, 84%, 39%)',
    borderColor: 'hsl(160, 84%, 39% / 0.3)',
    boxShadow: '0 4px 20px hsl(160, 84%, 39% / 0.15)',
  },
  error: {
    icon: XCircle,
    color: 'hsl(350, 89%, 60%)',
    borderColor: 'hsl(350, 89%, 60% / 0.3)',
    boxShadow: '0 4px 20px hsl(350, 89%, 60% / 0.15)',
  },
  warning: {
    icon: AlertTriangle,
    color: 'hsl(35, 92%, 50%)',
    borderColor: 'hsl(35, 92%, 50% / 0.3)',
    boxShadow: '0 4px 20px hsl(35, 92%, 50% / 0.15)',
  },
  info: {
    icon: Info,
    color: 'hsl(250, 89%, 65%)',
    borderColor: 'hsl(250, 89%, 65% / 0.3)',
    boxShadow: '0 4px 20px hsl(250, 89%, 65% / 0.15)',
  },
};
