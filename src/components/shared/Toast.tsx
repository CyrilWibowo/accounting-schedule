import React, { useState, useEffect, useCallback } from 'react';
import './Toast.css';

export type ToastType = 'success' | 'edit' | 'delete';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  const [exiting, setExiting] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(240);

  useEffect(() => {
    const sidebar = document.querySelector('.sidebar') as HTMLElement;
    if (sidebar) setSidebarWidth(sidebar.offsetWidth);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setExiting(true), 2700);
    const removeTimer = setTimeout(onClose, 3000);
    return () => { clearTimeout(timer); clearTimeout(removeTimer); };
  }, [onClose]);

  const left = sidebarWidth + (window.innerWidth - sidebarWidth) / 2;

  return (
    <div className={`toast toast-${type}${exiting ? ' toast-exit' : ''}`} style={{ left: `${left}px` }}>
      {message}
    </div>
  );
};

export const useToast = () => {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = useCallback((message: string, type: ToastType) => {
    setToast({ message, type });
  }, []);

  const clearToast = useCallback(() => setToast(null), []);

  return { toast, showToast, clearToast };
};

export default Toast;
