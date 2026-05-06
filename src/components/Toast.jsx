import { useState, useEffect } from 'react';

export default function Toast({ toast }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(t);
  }, [toast?.key]);

  if (!toast || !visible) return null;

  return (
    <div className={`toast toast-${toast.type} ${visible ? 'toast-show' : ''}`}>
      <span>{toast.msg}</span>
      <button className="toast-close" onClick={() => setVisible(false)}>✕</button>
    </div>
  );
}
