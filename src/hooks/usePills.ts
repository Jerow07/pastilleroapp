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
        console.log(`[Sync] Intentando sincronizar código: ${code}`);
        try {
          const res = await fetch(`/api/pills?user=${code}`);
          console.log(`[Sync] Respuesta API: ${res.status}`);
          
          if (res.ok) {
            const cloudData = await res.json();
            console.log(`[Sync] Datos en nube: ${Array.isArray(cloudData) ? cloudData.length : 'Error'} items`);
            
            if (Array.isArray(cloudData)) {
              // Mezclamos por ID para no perder nada de ningún dispositivo
              const mergedMap = new Map();
              
              // Primero metemos lo local
              localPills.forEach(p => mergedMap.set(p.id, p));
              
              // Luego metemos lo de la nube (si el ID ya existe, la nube manda porque suele ser lo más reciente)
              cloudData.forEach(p => {
                const existing = mergedMap.get(p.id);
                // Si no existe, o si la versión de la nube tiene más registros de tomas, la nube gana
                if (!existing || (Array.isArray(p.takenDates) && p.takenDates.length >= (existing.takenDates?.length || 0))) {
                  mergedMap.set(p.id, p);
                }
              });

              const mergedPills = Array.from(mergedMap.values());
              console.log(`[Sync] Resultado de la mezcla: ${mergedPills.length} items`);
              
              setPills(mergedPills);
              localStorage.setItem(`pillapp_pills_${code}`, JSON.stringify(mergedPills));

              // Si el resultado de la mezcla es distinto a lo que había en la nube, sincronizamos "para arriba"
              if (mergedPills.length !== cloudData.length || cloudData.length === 0) {
                console.log(`[Sync] Subiendo mezcla a la nube...`);
                const postRes = await fetch('/api/pills', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ user: code, pills: mergedPills }),
                });
                if (!postRes.ok) {
                  throw new Error(`Error en POST: ${postRes.status}`);
                }
              }
            }
          } else {
            throw new Error(`Error en GET: ${res.status}`);
          }
        } catch (err) {
          console.error('[Sync] Error crítico de sincronización:', err);
          window.alert(`⚠️ Error de Sincronización: No se pudo conectar con la base de datos. Verifica tu conexión o las variables de entorno.`);
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

  // Sincronización automática periódica y por foco
  useEffect(() => {
    if (!secretCode) return;

    // 1. Cada 15 segundos (para no agotar la cuota de la base de datos gratis)
    const interval = setInterval(() => {
      console.log('[AutoSync] Ejecutando sincronización periódica...');
      setSecretCode(null);
      setTimeout(() => setSecretCode(secretCode), 10);
    }, 15000);

    // 2. Cuando el usuario vuelve a la pestaña de la app
    const handleFocus = () => {
      console.log('[AutoSync] Foco detectado, sincronizando...');
      setSecretCode(null);
      setTimeout(() => setSecretCode(secretCode), 10);
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
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
    deletePill,
    refresh: () => {
      const code = localStorage.getItem('pillapp_secret');
      if (code) {
        setSecretCode(null); // Force re-run of effect
        setTimeout(() => setSecretCode(code.trim().toLowerCase()), 10);
      }
    }
  };
}
