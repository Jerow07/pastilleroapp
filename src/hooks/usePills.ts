import { useState, useEffect, useCallback } from 'react';
import type { Pill } from '../lib/types';

export function usePills() {
  const [secretCode, setSecretCode] = useState<string | null>(null);
  const [pills, setPills] = useState<Pill[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Cargar el secret code y pastillas iniciales de LocalStorage
  useEffect(() => {
    const code = localStorage.getItem('pillapp_secret');
    if (code) {
      setSecretCode(code);
      const saved = localStorage.getItem(`pillapp_pills_${code}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.every(p => p && typeof p === 'object' && 'id' in p)) {
            setPills(parsed);
          } else {
            localStorage.removeItem(`pillapp_pills_${code}`);
          }
        } catch (e) {
          localStorage.removeItem(`pillapp_pills_${code}`);
        }
      }
    }
  }, []);

  // Fetch pills para actualizar la caché
  useEffect(() => {
    if (!secretCode) return;

    const fetchPills = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/pills?user=${secretCode}`);
        if (res.ok) {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const cloudData = await res.json();
            if (cloudData && Array.isArray(cloudData)) {
              if (cloudData.length > 0) {
                setPills(cloudData);
                localStorage.setItem(`pillapp_pills_${secretCode}`, JSON.stringify(cloudData));
              } else if (pills.length > 0) {
                syncPills(pills);
              }
            }
          }
        }
      } catch (err) {
        console.error('Error fetching pills (offline?):', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPills();
  }, [secretCode]);

  const saveSecretCode = (code: string, name?: string) => {
    localStorage.setItem('pillapp_secret', code);
    if (name) localStorage.setItem(`pillapp_userName_${code}`, name);
    setSecretCode(code);
    
    // Cargar pastillas locales inmediatamente para evitar pantalla vacía
    const saved = localStorage.getItem(`pillapp_pills_${code}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setPills(parsed);
      } catch (e) {}
    }

    // Registrar el nombre en la nube en segundo plano
    if (name) {
      fetch('/api/pills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: code, name }),
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
    
    // Guardar siempre en local primero
    localStorage.setItem(`pillapp_pills_${secretCode}`, JSON.stringify(newPills));
    
    setSyncing(true);
    try {
      await fetch('/api/pills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: secretCode, pills: newPills }),
      });
    } catch (err) {
      console.warn('No se pudo sincronizar con la nube (se guardó en local):', err);
    } finally {
      setSyncing(false);
    }
  };

  const addPill = useCallback((pill: Pill) => {
    const newPills = [...pills, pill];
    setPills(newPills);
    syncPills(newPills);
  }, [pills, secretCode]);

  const updatePill = useCallback((updatedPill: Pill) => {
    const newPills = pills.map((p) => p.id === updatedPill.id ? updatedPill : p);
    setPills(newPills);
    syncPills(newPills);
  }, [pills, secretCode]);

  const togglePillTaken = useCallback((pillId: string, dateStr: string) => {
    const newPills = pills.map((p) => {
      if (p.id === pillId) {
        const isTaken = p.takenDates.includes(dateStr);
        const newDates = isTaken
          ? p.takenDates.filter(d => d !== dateStr) // untake
          : [...p.takenDates, dateStr]; // take
        
        // Manejo de Stock (Baúl)
        let newTotalStock = p.totalStock;
        if (p.stockEnabled && p.totalStock !== undefined && p.quantityPerDose !== undefined) {
          if (!isTaken) {
            // Estamos marcando como tomada -> Restar stock
            newTotalStock = Math.max(0, p.totalStock - p.quantityPerDose);
            
            // Notificación de stock bajo (3 dosis o menos)
            if (newTotalStock <= p.quantityPerDose * 3) {
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(`¡Stock bajo: ${p.name}!`, {
                  body: `Te quedan solo ${newTotalStock} ${p.unit || 'unidades'} en el baúl.`,
                  icon: '/pwa-192x192.png'
                });
              }
            }
          } else {
            // Estamos desmarcando -> Devolver stock
            newTotalStock = p.totalStock + p.quantityPerDose;
          }
        }

        return { ...p, takenDates: newDates, totalStock: newTotalStock };
      }
      return p;
    });
    setPills(newPills);
    syncPills(newPills);
  }, [pills, secretCode]);

  const deletePill = useCallback((pillId: string) => {
    const newPills = pills.filter(p => p.id !== pillId);
    setPills(newPills);
    syncPills(newPills);
  }, [pills, secretCode]);

  return {
    secretCode,
    saveSecretCode,
    logout,
    pills,
    loading,
    syncing,
    addPill,
    updatePill,
    togglePillTaken,
    deletePill
  };
}
