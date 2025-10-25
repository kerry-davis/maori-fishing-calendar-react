import { useEffect, useRef, useState } from 'react';
import { useSyncStatus } from '@shared/hooks/useSyncStatus';

export const SyncToast: React.FC = () => {
  const { syncQueueLength, lastSyncTime } = useSyncStatus();
  const prevLenRef = useRef(syncQueueLength);
  const [visible, setVisible] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const prev = prevLenRef.current;
    if (prev > 0 && syncQueueLength === 0) {
      const ts = lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString() : 'now';
      setMsg(`All changes synced (${ts})`);
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(t);
    }
    prevLenRef.current = syncQueueLength;
  }, [syncQueueLength, lastSyncTime]);

  if (!visible) return null;

  return (
    <div className="fixed top-16 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
      <div className="bg-green-500 dark:bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
        <i className="fas fa-check-circle" />
        <span>{msg}</span>
        <button
          onClick={() => setVisible(false)}
          className="ml-2 hover:text-green-200 transition-colors"
          aria-label="Close message"
        >
          <i className="fas fa-times" />
        </button>
      </div>
    </div>
  );
};

export default SyncToast;
