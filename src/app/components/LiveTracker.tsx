'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function LiveTracker() {
  const router = useRouter();

  useEffect(() => {
    // Poll the sync endpoint and then refresh the server components
    // This gives the dashboard real-time "Live Now" updates
    const interval = setInterval(async () => {
      try {
        // Sync recent calls from Ultravox (fast if no new calls)
        await fetch('/api/sync', { method: 'POST' });
        // Refresh the server-rendered dashboard to show new calls
        router.refresh();
      } catch (e) {
        console.error('Live sync error:', e);
      }
    }, 15000); // Every 15 seconds

    return () => clearInterval(interval);
  }, [router]);

  return null;
}
