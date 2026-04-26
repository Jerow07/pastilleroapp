import { useState, useEffect, useCallback } from 'react';
import type { Pill } from '../lib/types';

export function usePills() {
  const [secretCode, setSecretCode] = useState<string | null>(null);
  const [pills, setPills] = useState<Pill[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Cargar inicial y sincronizar
  useEffect(() => {
    const rawCode = localStorage.getItem('pillapp_secret');
    if (rawCode) {
      const code = rawCode.trim().toLowerCase();
      setSecretCode(code);
      
      const loadAndSync = async () => {
        setLoading(true);
        
        // 1. Cargar lo que haya en LocalStorage primero (Caché rápida)
        let localPills: Pill[] = [];
        const saved = localStorage.getItem(`pillapp_pills_${code}`);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              localPills = parsed;
              setPills(localPills);
            }
          } catch (e) {}
        }

        // 2. Intentar traer de la nube
        try {
          const res = await fetch(`/api/pills?user=${code}`);
          if (res.ok) {
            const cloudData = await res.json();
            if (Array.isArray(cloudData)) {
              if (cloudData.length > 0) {
                // La nube manda
                setPills(cloudData);
                localStorage.setItem(`pillapp_pills_${code}`, JSON.stringify(cloudData));
              } else if (localPills.length > 0) {
                // Nube vacía pero local tiene algo -> Sincronizar hacia arriba
                await fetch('/api/pills', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ user: code, pills: localPills }),
                });
              }
            }
          }
        } catch (err) {
          console.error('Error en sincronización inicial:', err);
        } finally {
          setLoading(false);
        }
      };

      loadAndSync();
    }
  }, [secretCode]); // Se dispara cuando cambia el código (login/logout)

  const saveSecretCode = (code: string, name?: string) => {
    const normalizedCode = code.trim().toLowerCase();
    localStorage.setItem('pillapp_secret', normalizedCode);
    if (name) localStorage.setItem(`pillapp_userName_${normalizedCode}`, name);
    setSecretCode(normalizedCode);
    
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
