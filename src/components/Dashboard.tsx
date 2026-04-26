import { useState, useEffect } from 'react';
import type { Pill } from '../lib/types';
import { format, addDays, subDays, isToday, getDay, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Check, 
  Clock, 
  LogOut, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  Bell, 
  BellOff,
  Flame,
  Moon,
  Sun,
  Package,
  ArrowLeft,
  Edit2,
  Share2,
  Users,
  Cloud,
  RefreshCw,
  Calendar
} from 'lucide-react';
import { cn } from '../lib/utils';
import { CalendarModal } from './CalendarModal';
import { ConfirmationModal } from './ConfirmationModal';
import confetti from 'canvas-confetti';

interface DashboardProps {
  pills: Pill[];
  onTogglePill: (id: string, dateStr: string) => void;
  onLogout: () => void;
  onAddPill: () => void;
  onEditPill: (pill: Pill) => void;
  onDeletePill: (id: string) => void;
  onUpdatePill: (pill: Pill) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  secretCode: string | null;
  loading: boolean;
  syncing: boolean;
  notificationsEnabled: boolean;
  onToggleNotifications: () => void;
  onRefresh: () => void;
}

export function Dashboard({ 
  pills, 
  onTogglePill, 
  onLogout, 
  onAddPill, 
  onEditPill,
  onDeletePill,
  onUpdatePill,
  darkMode,
  toggleDarkMode,
  secretCode,
  loading,
  syncing,
  notificationsEnabled,
  onToggleNotifications,
  onRefresh
}: DashboardProps) {
  const [activeView, setActiveView] = useState<'dashboard' | 'stock' | 'admin'>('dashboard');
  const [adminUsers, setAdminUsers] = useState<{code: string, name: string}[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [userName] = useState(() => localStorage.getItem(`pillapp_userName_${secretCode}`) || 'Amigo');
  const [motivePhrase, setMotivePhrase] = useState('');
  const [pillToDelete, setPillToDelete] = useState<Pill | null>(null);

  useEffect(() => {
    const phrases = [
      `¡Haciendo un gran trabajo, ${userName}!`,
      `Un día más cuidándote, ${userName}. ✨`,
      `¡Vas muy bien, ${userName}! Queda poco.`,
      `¡Energía positiva para hoy, ${userName}! 🔋`,
      `Tu salud es lo primero, ${userName}. 💖`,
      `¡Día perfecto a la vista, ${userName}! 🚀`
    ];
    setMotivePhrase(phrases[Math.floor(Math.random() * phrases.length)]);
  }, [userName, selectedDate]); // Cambia al cambiar de día o nombre

  const isAdmin = secretCode === 'admin-jeronimo';
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const currentDayOfWeek = getDay(selectedDate);

  useEffect(() => {
    if (isAdmin && activeView === 'admin') {
      setAdminLoading(true);
      fetch(`/api/users`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setAdminUsers(data);
          }
          setAdminLoading(false);
        })
        .catch(() => setAdminLoading(false));
    }
  }, [activeView, isAdmin]);
  
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>('default');

  const VAPID_PUBLIC_KEY = "BNmvP2Pkwh_HsZOVNyh0JSH2oBZAWjODRgauJ-yum6IMbZudPhnOiUZKQcMYr8LuecRC92-ZZb-F-p8LC6p98G4";

  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
    return outputArray;
  }

  const subscribeToPush = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      const secretCode = localStorage.getItem('pillapp_secret');
      if (secretCode) {
        await fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: secretCode, subscription })
        });
      }
    } catch (err) {
      console.error('Push error:', err);
    }
  };

  useEffect(() => {
    if ('Notification' in window) {
      setNotifPerm(Notification.permission);
    }
  }, []);

  const handleNotificationClick = async () => {
    if ('Notification' in window) {
      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        setNotifPerm(permission);
        if (permission === 'granted') {
          await subscribeToPush();
          if (!notificationsEnabled) onToggleNotifications();
        }
      } else {
        onToggleNotifications();
      }
    }
  };

  // Protección total contra datos corruptos o viejos
  const safePills = Array.isArray(pills) ? pills.filter(p => p && typeof p === 'object' && p.id && p.takenDates) : [];
  const sortedPills = [...safePills].sort((a, b) => a.time.localeCompare(b.time));
  
  const displayedPills = sortedPills.filter(pill => {
    // Usar fecha local para la comparación
    if (pill.createdAt) {
      const createdDate = new Date(pill.createdAt);
      const today = new Date();
      today.setHours(0,0,0,0);
      const selDate = new Date(selectedDate);
      selDate.setHours(0,0,0,0);
      
      if (selDate < new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate())) return false;
    }
    const isTaken = pill.takenDates.includes(dateStr);
    
    // Proyección de stock
    if (pill.stockEnabled && pill.totalStock !== undefined && pill.quantityPerDose !== undefined) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const targetDate = new Date(selectedDate);
      targetDate.setHours(0, 0, 0, 0);

      if (targetDate > today && !isTaken) {
        let scheduledDosesCount = 0;
        let tempDate = addDays(today, 1);
        while (tempDate <= targetDate) {
          const tempDayOfWeek = getDay(tempDate);
          const isScheduled = !pill.frequency || pill.frequency === 'daily' || 
            (pill.frequency === 'specific_days' && pill.selectedDays?.includes(tempDayOfWeek));
          if (isScheduled) scheduledDosesCount++;
          tempDate = addDays(tempDate, 1);
          if (scheduledDosesCount > 1000) break; // Seguridad
        }
        if (pill.totalStock < (scheduledDosesCount * pill.quantityPerDose)) return false;
      } else if (pill.totalStock <= 0 && !isTaken) {
        return false;
      }
    }

    if (!pill.frequency || pill.frequency === 'daily') {
      return true;
    }
    if (pill.frequency === 'specific_days' && pill.selectedDays) {
      return pill.selectedDays.includes(currentDayOfWeek);
    }
    return false;
  });

  const handleToggle = (id: string) => {
    const pill = displayedPills.find(p => p.id === id);
    if (!pill) return;
    const isCurrentlyTaken = pill.takenDates.includes(dateStr);
    onTogglePill(id, dateStr);

    if (!isCurrentlyTaken) {
      new Audio('/sounds/check.mp3').play().catch(() => {});
      const remaining = displayedPills.filter(p => p.id !== id && !p.takenDates.includes(dateStr)).length;
      if (remaining === 0) {
        setTimeout(() => new Audio('/sounds/success.mp3').play().catch(() => {}), 500);
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      }
    }
  };

  const handleRefill = (pill: Pill) => {
    const amount = window.prompt(`¿Nuevo total para ${pill.name}?`, (pill.totalStock || 0).toString());
    if (amount !== null && !isNaN(parseFloat(amount))) {
      onUpdatePill({ ...pill, totalStock: parseFloat(amount) });
    }
  };

  const generateMedicalReport = () => {
    const last7Days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), i)).reverse();
    let report = `*Reporte de Medicación - ${userName}* 🏥\n\n`;
    
    last7Days.forEach(day => {
      const dStr = format(day, 'yyyy-MM-dd');
      const dLabel = format(day, 'EEEE d', { locale: es });
      const dayOfWeek = getDay(day);
      
      const dayPills = pills.filter(p => {
        if (p.createdAt && day < startOfDay(new Date(p.createdAt))) return false;
        return !p.frequency || p.frequency === 'daily' || (p.frequency === 'specific_days' && p.selectedDays?.includes(dayOfWeek));
      });

      if (dayPills.length > 0) {
        const taken = dayPills.filter(p => p.takenDates.includes(dStr)).length;
        const percent = Math.round((taken / dayPills.length) * 100);
        report += `*${dLabel}:* ${percent}% (${taken}/${dayPills.length})\n`;
      }
    });

    report += `\n_Generado por Mi Pastillero Virtual_ 💊`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(report)}`;
    window.open(waUrl, '_blank');
  };

  const takenCount = displayedPills.filter(p => p.takenDates.includes(dateStr)).length;

  return (
    <div className={cn(
      "min-h-screen font-sans flex flex-col items-center justify-center p-4 md:p-8 overflow-x-hidden",
      "bg-[url('/bg.png')] bg-cover bg-center bg-fixed"
    )}>
      {/* Recuadro de la App - Estilo Redondeado Premium */}
      <div className={cn(
        "w-full max-w-md min-h-[90vh] md:h-[850px] p-4 pb-32 flex flex-col relative transition-all duration-500 shadow-[0_0_80px_rgba(0,0,0,0.4)] z-10",
        "rounded-[3rem] border-4 border-white/20 overflow-hidden",
        darkMode ? "bg-[#0c141d]/95 text-white" : "bg-[#f0f9ff]/95 text-slate-900"
      )}>
        {/* Header */}
        <header className={cn(
          "mb-8 border-2 p-6 rounded-[2.5rem] sticky top-4 z-20 transition-all",
          darkMode 
            ? "bg-[#162534]/90 backdrop-blur-md border-orange-300 shadow-[0_0_20px_rgba(253,186,116,0.2)]" 
            : "bg-white/90 backdrop-blur-md border-orange-100 shadow-[0_10px_30px_rgba(253,186,116,0.3)]"
        )}>
        <div className="flex justify-between items-center mb-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              {activeView !== 'dashboard' && (
                <button onClick={() => setActiveView('dashboard')} className="p-1 -ml-1"><ArrowLeft size={24} className={darkMode ? "text-orange-300" : "text-sky-500"} /></button>
              )}
              <h1 className={cn("text-3xl font-black italic tracking-tight", darkMode ? "text-orange-300" : "text-sky-600")}>
                {activeView === 'dashboard' ? 'Mi Pastillero' : (activeView === 'stock' ? 'El Baúl' : 'Gestión')}
              </h1>
              <div className="flex flex-col ml-1 gap-1">
                <span className="text-[8px] font-black opacity-30 uppercase tracking-widest leading-none">v1.5.0</span>
                
                {/* Sync Indicator */}
                <div 
                  onClick={onRefresh}
                  className={cn(
                    "flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[7px] font-black uppercase tracking-tighter transition-all duration-500 cursor-pointer active:scale-95",
                    syncing || loading 
                      ? (darkMode ? "bg-orange-500/10 border-orange-500/50 text-orange-400" : "bg-sky-50 border-sky-200 text-sky-500")
                      : (darkMode ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-600")
                  )}>
                  {syncing || loading ? (
                    <RefreshCw size={8} className="animate-spin" />
                  ) : (
                    <Cloud size={8} />
                  )}
                  <span>{syncing ? 'Sync' : (loading ? 'Cargando' : 'OK')}</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setIsCalendarOpen(true)} 
              className={cn(
                "font-bold text-sm text-left uppercase transition-all flex items-center gap-2 group",
                darkMode ? "text-white" : "text-slate-500"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-lg border-2 transition-all group-active:scale-90",
                darkMode ? "bg-black border-orange-900 text-orange-400" : "bg-white border-sky-100 text-sky-500 shadow-sm"
              )}>
                <Calendar size={14} strokeWidth={3} />
              </div>
              {isToday(selectedDate) ? (
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "border-2 px-3 py-1 rounded-xl font-black tracking-widest text-sm transition-all",
                    darkMode 
                      ? "bg-orange-500 border-white text-black shadow-[0_0_15px_rgba(249,115,22,0.5)]" 
                      : "bg-sky-100 border-sky-200 text-sky-700"
                  )}>
                    HOY
                  </span>
                  <span className="opacity-60 text-xs">, {format(selectedDate, "d 'de' MMMM", { locale: es })}</span>
                </div>
              ) : (
                <span className="opacity-60 text-xs">{format(selectedDate, "eeee, d 'de' MMMM", { locale: es })}</span>
              )}
            </button>
          </div>
          <div className={cn(
            "border-2 p-2 rounded-2xl flex flex-col items-center min-w-[60px] transition-all",
            darkMode 
              ? "bg-[#1A1A1A] border-orange-400 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.3)]" 
              : "bg-orange-50 border-orange-200 text-orange-600"
          )}>
            <Flame size={24} fill="currentColor" />
            <span className="font-black text-xl">{activeView === 'dashboard' ? `${takenCount}/${displayedPills.length}` : (activeView === 'stock' ? pills.filter(p => p.stockEnabled).length : adminUsers.length)}</span>
          </div>
        </div>

        {/* Barra de Progreso */}
        {activeView === 'dashboard' && displayedPills.length > 0 && (
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1.5 px-1">
              <span className={cn("text-[10px] font-black uppercase tracking-tighter", darkMode ? "text-orange-300/60" : "text-sky-600/60")}>
                Progreso del día
              </span>
              <span className={cn("text-[10px] font-black", darkMode ? "text-orange-300" : "text-sky-700")}>
                {Math.round((takenCount / displayedPills.length) * 100)}%
              </span>
            </div>
            <div className={cn("h-3 w-full rounded-full border-2 overflow-hidden", darkMode ? "bg-black border-orange-900" : "bg-sky-50 border-sky-100")}>
              <div 
                className={cn(
                  "h-full transition-all duration-700 ease-out rounded-full",
                  darkMode ? "bg-orange-300 shadow-[0_0_10px_rgba(253,186,116,0.5)]" : "bg-sky-400"
                )}
                style={{ width: `${(takenCount / displayedPills.length) * 100}%` }}
              />
            </div>
            {motivePhrase && (
              <p className={cn("text-[11px] font-bold italic mt-2 px-1 opacity-80", darkMode ? "text-orange-200" : "text-sky-800")}>
                "{motivePhrase}"
              </p>
            )}
          </div>
        )}

        <div className="flex justify-between items-center pt-2 border-t-2 border-black/5">
          <div className="flex items-center space-x-2">
            <button onClick={() => setSelectedDate(subDays(selectedDate, 1))} className={cn("p-2 border-2 rounded-xl transition-all", darkMode ? "bg-black border-orange-900 text-orange-400" : "bg-white border-sky-100 text-sky-600")}><ChevronLeft size={20} /></button>
            <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} className={cn("p-2 border-2 rounded-xl transition-all", darkMode ? "bg-black border-orange-900 text-orange-400" : "bg-white border-sky-100 text-sky-600")}><ChevronRight size={20} /></button>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={generateMedicalReport} 
              className={cn(
                "p-2 border-2 rounded-xl transition-all active:scale-95", 
                darkMode ? "bg-orange-900/20 border-orange-400 text-orange-400" : "bg-sky-50 border-sky-400 text-sky-600"
              )}
              title="Reporte para el médico"
            >
              <Share2 size={20} />
            </button>
            <button onClick={toggleDarkMode} className={cn("p-2 border-2 rounded-xl transition-all", darkMode ? "bg-black border-orange-400 text-orange-400" : "bg-white border-black text-black")}>{darkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
            <button onClick={handleNotificationClick} className={cn("p-2 border-2 rounded-xl transition-all", darkMode ? "bg-black border-orange-400 text-orange-400" : "bg-white border-black text-black")}>
              {notificationsEnabled && notifPerm === 'granted' ? <Bell size={20} /> : <BellOff size={20} />}
            </button>
            <button onClick={onLogout} className={cn("p-2 border-2 rounded-xl transition-all", darkMode ? "bg-black border-orange-400 text-orange-400" : "bg-white border-black text-black")}><LogOut size={20} /></button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-md mx-auto space-y-6">
        {isAdmin && activeView === 'admin' ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-cyan-400 rounded-2xl border-2 border-white text-black shadow-[0_0_15px_rgba(34,211,238,0.5)]">
                <Users size={24} strokeWidth={3} />
              </div>
              <div>
                <h2 className="text-2xl font-black uppercase italic tracking-tight text-cyan-400">Gestión de Usuarios</h2>
                <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest text-white">Listado de Códigos Activos</p>
              </div>
            </div>
            
            <div className="grid gap-3">
              {adminLoading ? (
                <div className="text-center py-10 opacity-50 animate-pulse font-black text-cyan-400">CARGANDO USUARIOS...</div>
              ) : adminUsers && Array.isArray(adminUsers) && adminUsers.map((userObj) => {
                if (!userObj || !userObj.code) return null;
                const userName = userObj.name || 'Usuario Anónimo';
                return (
                  <div key={userObj.code} className={cn(
                    "p-4 border-2 rounded-2xl transition-all",
                    darkMode 
                      ? "bg-[#121214] border-cyan-500 shadow-[0_0_15px_rgba(34,211,238,0.1)]" 
                      : "bg-white border-blue-100 shadow-[0_4px_15px_rgba(186,230,253,0.3)]"
                  )}>
                    <div className="flex flex-col">
                      <span className={cn(
                        "font-black tracking-tight uppercase italic text-lg leading-tight",
                        darkMode ? "text-white" : "text-blue-900"
                      )}>{userName}</span>
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-widest",
                        darkMode ? "text-cyan-400" : "text-blue-400"
                      )}>{userObj.code}</span>
                    </div>
                  </div>
                );
              })}
              {(!adminUsers || adminUsers.length === 0) && !adminLoading && (
                <div className="text-center py-10 opacity-30 italic">No hay usuarios registrados todavía.</div>
              )}
            </div>
          </div>
        ) : activeView === 'dashboard' ? (
          <div className="grid gap-6">
            {displayedPills.map((pill) => {
              const isTaken = pill.takenDates.includes(dateStr);
              return (
                <div key={pill.id} onClick={() => handleToggle(pill.id)} className={cn(
                  "relative px-4 py-4 border-2 rounded-[2rem] transition-all cursor-pointer",
                  isTaken 
                    ? "opacity-30 scale-95" 
                    : (darkMode 
                        ? "bg-[#1A1A1A] border-cyan-500 shadow-[0_0_15px_rgba(34,211,238,0.15)] hover:shadow-[0_0_25px_rgba(34,211,238,0.3)]" 
                        : "bg-white border-blue-100 shadow-[0_4px_20px_rgba(186,230,253,0.3)] hover:shadow-[0_10px_30px_rgba(186,230,253,0.5)]")
                )}>
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "text-3xl border-2 p-2.5 rounded-2xl transition-all flex-shrink-0",
                      darkMode ? "bg-black border-cyan-900" : "bg-blue-50 border-blue-100"
                    )}>{pill.emoji || '💊'}</div>
                    <div className="flex-1 min-w-0">
                      <div className={cn(
                        "text-[10px] font-black uppercase opacity-60 flex items-center gap-1",
                        darkMode ? "text-cyan-400" : "text-blue-500"
                      )}><Clock size={10} /> {pill.time}</div>
                      <h3 className={cn("text-xl font-black truncate", !darkMode && "text-slate-800")}>{pill.name}</h3>
                      <p className={cn("font-bold text-xs opacity-60 truncate", !darkMode && "text-slate-500")}>{pill.dose}</p>
                      {pill.stockEnabled && (
                        <div className={cn(
                          "mt-1 text-[9px] font-black px-1.5 py-0.5 rounded border-2 w-fit max-w-full truncate",
                          pill.totalStock! <= (pill.quantityPerDose || 1) * 3 ? "bg-red-500 text-white border-white animate-pulse" : "bg-black/5 border-black/10 text-gray-500"
                        )}>
                          {pill.totalStock} {pill.unit} {pill.totalStock! <= (pill.quantityPerDose || 1) * 3 && "— ¡COMPRAR! ⚠️"}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-center gap-2 flex-shrink-0">
                      <div className={cn("w-10 h-10 rounded-full border-2 flex items-center justify-center", isTaken ? "bg-green-400 border-black" : "bg-white border-black")}>
                        {isTaken && <Check size={24} strokeWidth={4} />}
                      </div>
                      {!isTaken && (
                        <div className="flex gap-1.5">
                          <button onClick={(e) => { e.stopPropagation(); onEditPill(pill); }} className="p-1.5 border-2 rounded-lg bg-white border-black shadow-[1px_1px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"><Edit2 size={14} /></button>
                          <button onClick={(e) => { 
                            e.stopPropagation(); 
                            setPillToDelete(pill);
                          }} className="p-1.5 border-2 rounded-lg bg-white border-black text-red-600 shadow-[1px_1px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"><Trash2 size={14} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                  {isTaken && <div className="absolute -top-2 -right-2 text-[10px] font-black px-3 py-1 rounded-lg rotate-12 border-2 bg-black text-white border-white">COMPLETADO</div>}
                </div>
              );
            })}
            {displayedPills.length === 0 && (
              <div className={cn(
                "flex flex-col items-center justify-center py-12 px-6 text-center border-4 border-dashed rounded-[3rem] animate-in fade-in zoom-in duration-500",
                darkMode ? "border-orange-900/30 bg-black/20" : "border-sky-100 bg-white/50"
              )}>
                <div className={cn(
                  "w-24 h-24 mb-6 rounded-full flex items-center justify-center border-4 animate-bounce duration-[3000ms]",
                  darkMode ? "bg-[#162534] border-orange-300 text-orange-300" : "bg-sky-50 border-sky-200 text-sky-400"
                )}>
                  <Plus size={48} strokeWidth={3} />
                </div>
                <h3 className={cn("text-2xl font-black uppercase italic tracking-tight mb-2", darkMode ? "text-orange-200" : "text-sky-800")}>
                  ¡Nada por aquí!
                </h3>
                <p className={cn("text-sm font-bold opacity-60 mb-8 max-w-[200px]", darkMode ? "text-orange-100" : "text-sky-600")}>
                  No tienes pastillas programadas para {isToday(selectedDate) ? 'hoy' : 'este día'}.
                </p>
                <button 
                  onClick={onAddPill}
                  className={cn(
                    "px-8 py-4 rounded-2xl border-4 font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl flex items-center gap-2",
                    darkMode 
                      ? "bg-orange-300 border-white text-black" 
                      : "bg-orange-400 border-orange-200 text-white"
                  )}
                >
                  <Plus size={20} strokeWidth={4} /> Agregar Pastilla
                </button>
              </div>
            )}
          </div>
        ) : (activeView === 'stock') ? (
          <div className="space-y-6">
            <h2 className={cn(
              "text-3xl font-black uppercase italic tracking-tighter",
              darkMode ? "text-orange-300" : "text-sky-700"
            )}>Mi Inventario</h2>
            {pills.filter(p => p.stockEnabled).length === 0 ? (
              <div className={cn(
                "p-10 border-2 border-dashed rounded-[2.5rem] text-center",
                darkMode ? "border-orange-900 text-orange-900" : "border-sky-200 text-sky-300"
              )}>
                <Package size={48} className="mx-auto mb-4 opacity-20" />
                <p className="font-bold uppercase text-sm">Tu baúl está vacío</p>
                <p className="text-[10px] mt-2 italic">Activa el control de stock al añadir una pastilla</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pills.filter(p => p.stockEnabled).map(pill => (
                  <div key={pill.id} className={cn(
                    "p-5 border-2 rounded-[2.5rem] flex items-center gap-4 transition-all shadow-[0_4px_15px_rgba(0,0,0,0.1)]",
                    darkMode ? "bg-[#1A1A1A] border-orange-500" : "bg-white border-sky-100"
                  )}>
                    <div className={cn(
                      "text-3xl border-2 p-3 rounded-2xl shadow-sm",
                      darkMode ? "bg-black border-orange-900" : "bg-sky-50 border-sky-100"
                    )}>{pill.emoji || '💊'}</div>
                      <div className="flex-1">
                      <h3 className={cn("font-black text-xl", !darkMode && "text-slate-800")}>{pill.name}</h3>
                      <div className="flex flex-col">
                        <p className={cn(
                          "font-bold text-sm transition-colors", 
                          (pill.totalStock !== undefined && pill.quantityPerDose !== undefined && pill.totalStock <= pill.quantityPerDose * 3)
                            ? "text-red-500 animate-pulse" 
                            : (darkMode ? "text-orange-400" : "text-sky-600")
                        )}>
                          {pill.totalStock} <span className="opacity-60">{pill.unit} restantes</span>
                        </p>
                        {pill.totalStock !== undefined && pill.quantityPerDose !== undefined && pill.totalStock > 0 && (
                          <p className="text-[10px] font-bold opacity-40 italic uppercase tracking-tighter">
                            {(() => {
                              const q = pill.quantityPerDose || 1;
                              let stock = pill.totalStock;
                              let daysCount = 0;
                              let checkDate = new Date();
                              checkDate.setHours(0, 0, 0, 0);
                              
                              const todayStr = format(new Date(), 'yyyy-MM-dd');
                              const isTakenToday = pill.takenDates.includes(todayStr);

                              // Simulamos los días hacia adelante
                              for (let i = 0; i < 365; i++) {
                                const currentCheckDate = addDays(checkDate, i);
                                const dayOfWeek = currentCheckDate.getDay();
                                const isScheduled = !pill.frequency || pill.frequency === 'daily' || (pill.frequency === 'specific_days' && pill.selectedDays?.includes(dayOfWeek));
                                
                                if (isScheduled) {
                                  // Si es hoy y ya la tomó, no restamos del stock actual (porque ya se restó al marcarla)
                                  if (i === 0 && isTakenToday) {
                                    // No hacemos nada, el stock ya está actualizado
                                  } else {
                                    if (stock >= q) {
                                      stock -= q;
                                      daysCount++;
                                    } else {
                                      break; // Se acabó el stock
                                    }
                                  }
                                } else if (i === 0) {
                                  // Si hoy no toca, no hacemos nada
                                }
                              }

                              if (daysCount === 0) return 'Sin stock para la próxima toma';
                              return `Quedan ${daysCount} dosis`;
                            })()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => handleRefill(pill)} 
                        className={cn(
                          "px-4 py-2 border-2 rounded-xl font-black uppercase text-[10px] transition-all active:scale-95",
                          darkMode 
                            ? "bg-orange-300 border-white text-black shadow-[0_0_10px_rgba(253,186,116,0.3)]" 
                            : "bg-orange-400 border-orange-500 text-white shadow-[0_4px_10px_rgba(253,186,116,0.2)]"
                        )}
                      >
                        RECARGAR
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setPillToDelete(pill);
                        }} 
                        className={cn(
                          "p-2 border-2 rounded-xl transition-all active:scale-95 flex items-center justify-center",
                          darkMode ? "bg-red-900/20 border-red-900 text-red-500" : "bg-red-50 border-red-100 text-red-500"
                        )}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className={cn(
              "text-3xl font-black uppercase italic tracking-tighter",
              darkMode ? "text-orange-300" : "text-sky-700"
            )}>Gestión de Usuarios</h2>
            <div className="space-y-3">
              {adminUsers.map(user => (
                <div key={user.code} className={cn(
                  "p-4 border-2 rounded-2xl flex justify-between items-center",
                  darkMode ? "bg-[#1A1A1A] border-orange-900" : "bg-white border-sky-100 shadow-sm"
                )}>
                  <div>
                    <p className={cn("font-black text-lg", !darkMode && "text-slate-800")}>{user.name}</p>
                    <p className={cn("text-xs font-bold font-mono opacity-60", darkMode ? "text-orange-400" : "text-sky-600")}>{user.code}</p>
                  </div>
                  <Users size={20} className={darkMode ? "text-orange-900" : "text-sky-100"} />
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer / Credits */}
      <footer className="max-w-md mx-auto mt-12 mb-20 text-center space-y-4 px-6">
        <div className={cn(
          "p-6 border-2 rounded-[2.5rem] transition-all",
          darkMode ? "bg-[#121214] border-gray-800 text-gray-400" : "bg-white border-blue-100 text-slate-400"
        )}>
          <p className="text-xs font-bold uppercase tracking-widest mb-1">
            Desarrollado por <span className={darkMode ? "text-cyan-400" : "text-blue-600"}>Jerónimo Parra</span>
          </p>
          <p className="text-[10px] italic">"Uniendo tecnología y bienestar para todos"</p>
        </div>
        
        <button 
          onClick={() => {
            if (navigator.share) {
              navigator.share({
                title: 'Mi Pastillero',
                text: 'Gestiona tus medicamentos de forma fácil y segura con Mi Pastillero.',
                url: window.location.href
              }).catch(() => {});
            } else {
              navigator.clipboard.writeText(window.location.href);
              alert('¡Enlace copiado al portapapeles!');
            }
          }}
          className={cn(
            "flex items-center gap-2 mx-auto px-6 py-3 border-2 rounded-2xl font-black uppercase text-xs transition-all active:scale-95",
            darkMode 
              ? "bg-orange-300 border-white text-black shadow-[0_0_15px_rgba(253,186,116,0.5)]" 
              : "bg-orange-400 border-orange-200 text-white shadow-[0_4px_15px_rgba(253,186,116,0.3)]"
          )}
        >
          <Share2 size={16} strokeWidth={3} /> Compartir App
        </button>
      </footer>

      {/* Nav */}
      <nav className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 border-2 rounded-full p-2 flex gap-4 z-30 transition-all",
        darkMode 
          ? "bg-black/80 backdrop-blur-md border-orange-300 shadow-[0_0_20px_rgba(253,186,116,0.3)]" 
          : "bg-white/80 backdrop-blur-md border-orange-100 shadow-[0_10px_30px_rgba(253,186,116,0.4)]"
      )}>
        <button onClick={() => setActiveView('dashboard')} className={cn("p-3 rounded-full transition-all", activeView === 'dashboard' ? (darkMode ? "text-orange-300 bg-orange-300/10" : "text-sky-600 bg-sky-50") : "text-gray-400")}><Clock size={24} /></button>
        <button onClick={onAddPill} className={cn(
          "p-4 border-2 rounded-2xl transition-all active:scale-90",
          darkMode 
            ? "bg-orange-300 border-white text-black shadow-[0_0_15px_rgba(253,186,116,0.6)]" 
            : "bg-orange-400 border-orange-200 text-white shadow-[0_4px_15px_rgba(253,186,116,0.4)]"
        )}>
          <Plus size={28} strokeWidth={4} />
        </button>
        <button onClick={() => setActiveView('stock')} className={cn("p-3 rounded-full transition-all", activeView === 'stock' ? (darkMode ? "text-orange-300 bg-orange-300/10" : "text-sky-600 bg-sky-50") : "text-gray-400")}><Package size={24} /></button>
        {isAdmin && (
          <button onClick={() => setActiveView('admin')} className={cn("p-3 rounded-full transition-all", activeView === 'admin' ? (darkMode ? "text-orange-300 bg-orange-300/10" : "text-sky-600 bg-sky-50") : "text-gray-400")}><Users size={24} /></button>
        )}
      </nav>

      {isCalendarOpen && (
        <CalendarModal 
          selectedDate={selectedDate} 
          onSelectDate={setSelectedDate} 
          onClose={() => setIsCalendarOpen(false)}
          darkMode={darkMode}
          pills={pills}
        />
      )}

      <ConfirmationModal 
        isOpen={!!pillToDelete}
        title="¿Eliminar pastilla?"
        message={`¿Estás seguro de que deseas eliminar "${pillToDelete?.name}"? Esto también la quitará del Baúl y dejará de aparecer en tu tratamiento diario.`}
        onConfirm={() => {
          if (pillToDelete) {
            onDeletePill(pillToDelete.id);
            setPillToDelete(null);
          }
        }}
        onCancel={() => setPillToDelete(null)}
        darkMode={darkMode}
      />
      </div>
    </div>
  );
}
