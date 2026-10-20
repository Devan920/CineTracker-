'use client';
import { memo, useEffect, useState, type RefObject } from 'react';
import { Clock3 } from 'lucide-react';

// Keep the second-by-second clock out of the dashboard's render tree.
export default memo(function RefreshCountdown({ due, busy }: { due: RefObject<number>; busy: boolean }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (busy) return;
    const tick = () => {
      if (document.visibilityState === 'visible') {
        setRemaining(due.current ? Math.max(0, Math.ceil((due.current - Date.now()) / 1000)) : null);
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [busy, due]);
  const countdown = remaining === null ? '' : `${Math.floor(remaining / 60).toString().padStart(2, '0')}:${(remaining % 60).toString().padStart(2, '0')}`;
  return <span className="next-update"><Clock3 size={14}/>{busy ? 'Checking reports…' : remaining === null ? 'Connecting to reports…' : `Next check in ${countdown}`}<span className="help-text">· while open</span></span>;
});
