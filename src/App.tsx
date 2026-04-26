import { useState, useEffect } from 'react';
import type { Pill } from './lib/types';
import { AuthScreen } from './components/AuthScreen';
import { Dashboard } from './components/Dashboard';
import { AddPillModal } from './components/AddPillModal';
import { usePills } from './hooks/usePills';

import { InstallPWA } from './components/InstallPWA';

export default function App() {
  const { 
    secretCode, 
    saveSecretCode, 
    logout, 
    pills, 
    addPill, 
    updatePill,
    togglePillTaken, 
    deletePill 
  } = usePills();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingPill, setEditingPill] = useState<Pill | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('pillapp-dark') === 'true';
  });

  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const newVal = !prev;
      localStorage.setItem('pillapp-dark', String(newVal));
      return newVal;
    });
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    if (secretCode && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [secretCode]);

  useEffect(() => {
    if (!secretCode || pills.length === 0) return;

    const interval = setInterval(() => {
      const now = new Date();
      const currentHourMin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const todayStr = now.toISOString().split('T')[0];
      const currentDayOfWeek = now.getDay();

      pills.forEach((pill) => {
        const isScheduledToday = !pill.frequency || pill.frequency === 'daily' || (pill.frequency === 'specific_days' && pill.selectedDays?.includes(currentDayOfWeek));
        if (isScheduledToday && pill.time === currentHourMin && !pill.takenDates.includes(todayStr)) {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`¡Hora de tu pastilla: ${pill.name}!`, {
              body: `Dosis: ${pill.dose}. No olvides tomarla y marcarla en la app.`,
              icon: '/pwa-192x192.png'
            });
          }
        }
      });
    }, 60000);

    return () => clearInterval(interval);
  }, [pills, secretCode]);

  if (!secretCode) {
    return <AuthScreen onLogin={saveSecretCode} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />;
  }

  return (
    <>
      <Dashboard
        pills={pills}
        onTogglePill={togglePillTaken}
        onLogout={logout}
        onAddPill={() => setIsAddModalOpen(true)}
        onEditPill={setEditingPill}
        onDeletePill={deletePill}
        onUpdatePill={updatePill}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        secretCode={secretCode}
      />

      {(isAddModalOpen || editingPill) && (
        <AddPillModal 
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingPill(null);
          }} 
          onSave={(pill) => {
            if (editingPill) {
              updatePill(pill);
            } else {
              addPill(pill);
            }
            setIsAddModalOpen(false);
            setEditingPill(null);
          }}
          pill={editingPill || undefined}
          darkMode={darkMode}
        />
      )}

      <InstallPWA darkMode={darkMode} />
    </>
  );
}
