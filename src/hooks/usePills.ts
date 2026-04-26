import { useState, useEffect, useCallback } from 'react';
import type { Pill } from '../lib/types';

export function usePills() {
  const [secretCode, setSecretCode] = useState<string | null>(null);
  const [pills, setPills] = useState<Pill[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const loadAndSync = useCallback(async (code: string) => {
    if (!code) return;
    setLoading(true);
    
    let localPills: Pill[] = [];
    const saved = localStorage.getItem(`pillapp_pills_${code}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) localPills = parsed;
      } catch (e) {}
    }
    setPills(localPills);

    try {
      const res = await fetch(`/api/pills?user=${code}`);
      if (res.ok) {
        const cloudData = await res.json();
        if (Array.isArray(cloudData)) {
          const mergedMap = new Map<string, Pill>();
          localPills.forEach(p => mergedMap.set(p.id, p));
          
          cloudData.forEach(p => {
            const existing = mergedMap.get(p.id);
            if (!existing) {
              mergedMap.set(p.id, p);
            } else {
              const localTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime() || 0;
              const cloudTime = new Date(p.updatedAt || p.createdAt || 0).getTime() || 0;
              
              if (cloudTime > localTime) {
                mergedMap.set(p.id, p);
              } else if (cloudTime === localTime && (p.takenDates?.length || 0) > (existing.takenDates?.length || 0)) {
                mergedMap.set(p.id, p);
              }
            }
          });

          const mergedPills = Array.from(mergedMap.values());
          setPills(mergedPills);
          localStorage.setItem(`pillapp_pills_${code}`, JSON.stringify(mergedPills));

          await fetch('/api/pills', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: code, pills: mergedPills }),
          });
        }
      }
    } catch (err) {
      console.error('[Sync] Error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar inicial
  useEffect(() => {
    const rawCode = localStorage.getItem('pillapp_secret');
    if (rawCode) {
      const code = rawCode.trim().toLowerCase();
      setSecretCode(code);
      loadAndSync(code);
    }
  }, [loadAndSync]);

  const refresh = useCallback(() => {
    if (secretCode) {
      loadAndSync(secretCode);
    }
  }, [secretCode, loadAndSync]);

  const saveSecretCode = (code: string, name?: string) => {
    const normalizedCode = code.trim().toLowerCase();
    localStorage.setItem('pillapp_secret', normalizedCode);
    if (name) localStorage.setItem(`pillapp_userName_${normalizedCode}`, name);
    setSecretCode(normalizedCode);
    
    const saved = localStorage.getItem(`pillapp_pills_${normalizedCode}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setPills(parsed);
      } catch (e) {}
    }

    if (name) {
      fetch('/api/pills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: normalizedCode, name }),
      }).catch(() => {});
    }
  };

  const logout = () => {
    localStorage.removeItem('pillapp_secret');
    setSecretCode(null);
    setPills([]);
  };

  const syncPills = async (newPills: Pill[]) => {
    if (!secretCode) return;
    localStorage.setItem(`pillapp_pills_${secretCode}`, JSON.stringify(newPills));
    setSyncing(true);
    try {
      await fetch('/api/pills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: secretCode, pills: newPills }),
      });
    } catch (err) {
      console.warn('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  const addPill = useCallback((pill: Pill) => {
    const now = new Date().toISOString();
    const newPill = { ...pill, updatedAt: now, createdAt: now };
    setPills(prev => {
      const next = [...prev, newPill];
      syncPills(next);
      return next;
    });
  }, [secretCode]);

  const updatePill = useCallback((updatedPill: Pill) => {
    const now = new Date().toISOString();
    const newPill = { ...updatedPill, updatedAt: now };
    setPills(prev => {
      const next = prev.map((p) => p.id === updatedPill.id ? newPill : p);
      syncPills(next);
      return next;
    });
  }, [secretCode]);

  const togglePillTaken = useCallback((pillId: string, dateStr: string) => {
    const now = new Date().toISOString();
    setPills(prev => {
      const next = prev.map((p) => {
        if (p.id === pillId) {
          const isTaken = p.takenDates.includes(dateStr);
          const newDates = isTaken
            ? p.takenDates.filter(d => d !== dateStr)
            : [...p.takenDates, dateStr];
          
          let newTotalStock = p.totalStock;
          if (p.stockEnabled && p.totalStock !== undefined && p.quantityPerDose !== undefined) {
            newTotalStock = isTaken ? p.totalStock + p.quantityPerDose : Math.max(0, p.totalStock - p.quantityPerDose);
          }

          return { ...p, takenDates: newDates, totalStock: newTotalStock, updatedAt: now };
        }
        return p;
      });
      syncPills(next);
      return next;
    });
  }, [secretCode]);

  const deletePill = useCallback((pillId: string) => {
    const now = new Date().toISOString();
    setPills(prev => {
      const next = prev.map(p => p.id === pillId ? { ...p, deleted: true, updatedAt: now } : p);
      syncPills(next);
      return next;
    });
  }, [secretCode]);

  useEffect(() => {
    if (!secretCode) return;
    const interval = setInterval(() => {
      refresh();
    }, 15000);

    const handleFocus = () => refresh();
    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [secretCode, refresh]);

  return {
    secretCode,
    saveSecretCode,
    logout,
    pills: pills.filter(p => !p.deleted), // El UI solo ve las que NO están borradas
    loading,
    syncing,
    addPill,
    updatePill,
    togglePillTaken,
    deletePill,
    refresh
  };
}
