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
        
        // 1. Cargar LocalStorage
        let localPills: Pill[] = [];
        const saved = localStorage.getItem(`pillapp_pills_${code}`);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) localPills = parsed;
          } catch (e) {}
        }
        setPills(localPills);

        // 2. Traer de la nube y MERGE
        try {
          const res = await fetch(`/api/pills?user=${code}`);
          if (res.ok) {
            const cloudData = await res.json();
            if (Array.isArray(cloudData)) {
              // Mezclamos por ID para no perder nada de ningún dispositivo
              const mergedMap = new Map();
              
              // Primero metemos lo local
              localPills.forEach(p => mergedMap.set(p.id, p));
              
              // Luego metemos lo de la nube (si el ID ya existe, la nube manda porque suele ser lo más reciente)
              cloudData.forEach(p => {
                const existing = mergedMap.get(p.id);
                if (!existing || (p.takenDates.length >= existing.takenDates.length)) {
                  mergedMap.set(p.id, p);
                }
              });

              const mergedPills = Array.from(mergedMap.values());
              setPills(mergedPills);
              localStorage.setItem(`pillapp_pills_${code}`, JSON.stringify(mergedPills));

              // Si el resultado de la mezcla es distinto a lo que había en la nube, sincronizamos "para arriba"
              if (mergedPills.length !== cloudData.length) {
                await fetch('/api/pills', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ user: code, pills: mergedPills }),
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
    console.log('Adding pill:', pill.name);
    setPills(prev => {
      const next = [...prev, pill];
      syncPills(next);
      return next;
    });
  }, [secretCode]);

  const updatePill = useCallback((updatedPill: Pill) => {
    setPills(prev => {
      const next = prev.map((p) => p.id === updatedPill.id ? updatedPill : p);
      syncPills(next);
      return next;
    });
  }, [secretCode]);

  const togglePillTaken = useCallback((pillId: string, dateStr: string) => {
    setPills(prev => {
      const next = prev.map((p) => {
        if (p.id === pillId) {
          const isTaken = p.takenDates.includes(dateStr);
          const newDates = isTaken
            ? p.takenDates.filter(d => d !== dateStr)
            : [...p.takenDates, dateStr];
          
          let newTotalStock = p.totalStock;
          if (p.stockEnabled && p.totalStock !== undefined && p.quantityPerDose !== undefined) {
            if (!isTaken) {
              newTotalStock = Math.max(0, p.totalStock - p.quantityPerDose);
              
              if (newTotalStock <= p.quantityPerDose * 3) {
                if ('Notification' in window && Notification.permission === 'granted') {
                  new Notification(`¡Stock bajo: ${p.name}!`, {
                    body: `Te quedan solo ${newTotalStock} ${p.unit || 'unidades'} en el baúl.`,
                    icon: '/pwa-192x192.png'
                  });
                }
              }
            } else {
              newTotalStock = p.totalStock + p.quantityPerDose;
            }
          }

          return { ...p, takenDates: newDates, totalStock: newTotalStock };
        }
        return p;
      });
      syncPills(next);
      return next;
    });
  }, [secretCode]);

  const deletePill = useCallback((pillId: string) => {
    setPills(prev => {
      const next = prev.filter(p => p.id !== pillId);
      syncPills(next);
      return next;
    });
  }, [secretCode]);

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
