import { useState } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isToday,
  getDay,
  startOfDay
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Pill } from '../lib/types';

interface CalendarModalProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onClose: () => void;
  darkMode?: boolean;
  pills: Pill[];
}

export function CalendarModal({ selectedDate, onSelectDate, onClose, darkMode, pills }: CalendarModalProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(selectedDate));

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  // Función de éxito total: El día es verde SOLO si se tomaron TODAS las pastillas programadas.
  const isDayCompleted = (day: Date) => {
    if (!pills || pills.length === 0) return false;
    const dayStr = format(day, 'yyyy-MM-dd');
    const dw = getDay(day);
    
    // 1. Buscamos qué pastillas te tocaban ese día
    const dayScheduledPills = pills.filter(p => {
      if (p.deleted) return false;
      const isS = !p.frequency || p.frequency === 'daily' || (p.frequency === 'specific_days' && p.selectedDays?.includes(dw));
      if (!isS) return false;
      
      // Si no hay stock y no la tomó, no la contamos como "obligatoria" para completar el día
      if (p.stockEnabled && (p.totalStock || 0) <= 0 && !p.takenDates?.some(td => td.startsWith(dayStr))) return false;
      
      return true;
    });

    // Si no había nada programado, no puede estar "completado"
    if (dayScheduledPills.length === 0) return false;

    // 2. Verificamos si TODAS las tomas de esas pastillas están marcadas
    return dayScheduledPills.every(p => {
      if (!p.takenDates || !Array.isArray(p.takenDates)) return false;
      const times = p.times && p.times.length > 0 ? p.times : [p.time];
      return times.every(t => p.takenDates.includes(`${dayStr}|${t}`));
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className={cn(
        "w-full max-w-md rounded-[3rem] border-2 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200",
        darkMode ? "bg-[#162534] border-orange-300 text-white" : "bg-white border-orange-100 text-slate-900"
      )}>
        <div className={cn(
          "p-6 border-b-2 flex justify-between items-center",
          darkMode ? "bg-[#1c2e3f] border-orange-300" : "bg-orange-50 border-orange-100"
        )}>
          <h2 className="text-xl font-black uppercase italic tracking-tight">Calendario</h2>
          <button onClick={onClose} className={cn(
            "p-2 border-2 rounded-full transition-all active:scale-90",
            darkMode ? "bg-[#162534] border-orange-300 text-orange-300" : "bg-white border-orange-100 text-orange-400"
          )}>
            <X size={20} strokeWidth={3} />
          </button>
        </div>

        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <button 
              onClick={handlePrevMonth}
              className={cn(
                "p-2 border-2 rounded-xl transition-all active:scale-95",
                darkMode ? "bg-[#1c2e3f] border-orange-900 text-orange-300" : "bg-orange-50 border-orange-100 text-orange-400"
              )}
            >
              <ChevronLeft size={24} strokeWidth={3} />
            </button>
            <h3 className={cn(
              "text-lg font-black uppercase italic tracking-tight",
              darkMode ? "text-orange-300" : "text-sky-700"
            )}>
              {format(currentMonth, 'MMMM yyyy', { locale: es })}
            </h3>
            <button 
              onClick={handleNextMonth}
              className={cn(
                "p-2 border-2 rounded-xl transition-all active:scale-95",
                darkMode ? "bg-[#1c2e3f] border-orange-900 text-orange-300" : "bg-orange-50 border-orange-100 text-orange-400"
              )}
            >
              <ChevronRight size={24} strokeWidth={3} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map(day => (
              <div key={day} className="text-center text-[10px] font-black text-gray-400 uppercase tracking-widest opacity-40">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((day, idx) => {
              const isCurrentMonth = isSameMonth(day, monthStart);
              const isSelected = isSameDay(day, selectedDate);
              const today = isToday(day);
              // Determinar si el día está "fallado"
              const isPast = startOfDay(day) < startOfDay(new Date());
              const completed = isDayCompleted(day);
              
              const failed = (() => {
                if (completed) return false;
                if (!isDayScheduled(day)) return false;
                
                // Si es pasado y no está completado -> FALLO
                if (isPast) return true;
                
                // Si es hoy, solo es FALLO si alguna pastilla YA se pasó de hora
                if (today) {
                  const now = new Date();
                  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                  const dw = getDay(day);
                  const dayStr = format(day, 'yyyy-MM-dd');
                  const todayStart = startOfDay(new Date());
                  
                  return pills?.some(p => {
                    // Si no tiene createdAt, asumimos hoy
                    const pCreated = p.createdAt ? startOfDay(new Date(p.createdAt)) : todayStart;
                    if (startOfDay(day) < pCreated) return false;

                    const isS = !p.frequency || p.frequency === 'daily' || (p.frequency === 'specific_days' && p.selectedDays?.includes(dw));
                    if (!isS) return false;
                    // Si ya se pasó la hora y no la tomó -> FALLO
                    return p.time < currentTime && !p.takenDates?.includes(dayStr);
                  });
                }
                
                return false;
              })();

              function isDayScheduled(d: Date) {
                if (!pills) return false;
                const dw = getDay(d);
                const dStr = format(d, 'yyyy-MM-dd');
                const todayStart = startOfDay(new Date());
                
                return pills.some(p => {
                  // Si no tiene createdAt, asumimos hoy
                  const pCreated = p.createdAt ? startOfDay(new Date(p.createdAt)) : todayStart;
                  if (startOfDay(d) < pCreated) return false;

                  const isS = !p.frequency || p.frequency === 'daily' || (p.frequency === 'specific_days' && p.selectedDays?.includes(dw));
                  if (!isS) return false;
                  // Si no hay stock y no la tomó, no cuenta
                  if (p.stockEnabled && (p.totalStock || 0) <= 0 && !p.takenDates?.includes(dStr)) return false;
                  return true;
                });
              }

              return (
                <button
                  key={idx}
                  onClick={() => {
                    onSelectDate(day);
                    onClose();
                  }}
                  className={cn(
                    "h-12 w-full rounded-xl border-2 flex flex-col items-center justify-center text-sm font-black transition-all active:scale-95 relative",
                    // 1. Estado base
                    !isCurrentMonth && (darkMode ? "text-gray-800 border-gray-900 opacity-20" : "text-gray-300 border-gray-100 opacity-30"),
                    isCurrentMonth && (darkMode ? "bg-[#1c2e3f] border-orange-900 text-orange-900/40" : "bg-white border-orange-50 text-black"),
                    
                    // 2. Seleccionado (Naranja - Solo si no está hecho ni fallado)
                    isSelected && !completed && !failed && (darkMode ? "bg-orange-300 text-black" : "bg-orange-400 text-white shadow-lg"),
                    
                    // 3. FALLADO (Rojo - Solo si no está hecho)
                    failed && !completed && (darkMode ? "bg-red-500/60 border-red-500 text-white" : "bg-red-300 border-red-400 text-red-900 shadow-sm"),
                    
                    // 4. COMPLETADO (VERDE - PRIORIDAD MÁXIMA)
                    completed && (darkMode ? "bg-emerald-500 border-emerald-400 text-white" : "bg-green-400 border-green-500 text-black shadow-md"),
                    
                    // 5. HOY (Borde Azul para identificarlo siempre)
                    today && "border-blue-600 border-[3px] shadow-[0_0_10px_rgba(37,99,235,0.3)]",
                    
                    // 6. Anillo de selección (Siempre presente si está seleccionado)
                    isSelected && (darkMode ? "ring-4 ring-orange-300 ring-inset scale-110 z-10" : "ring-4 ring-orange-500 ring-inset scale-110 z-10 shadow-lg")
                  )}
                >
                  <span className={cn(today && "text-blue-700 font-black")}>{format(day, 'd')}</span>
                  {today && <span className="text-[7px] leading-none mt-0.5 text-blue-700 font-black">HOY</span>}
                  
                  {completed && <div className="absolute top-0.5 right-0.5 w-2 h-2 bg-green-600 rounded-full border border-white" />}
                  {failed && !completed && <div className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-600 rounded-full border border-white" />}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => {
              setCurrentMonth(new Date());
              onSelectDate(new Date());
              onClose();
            }}
            className={cn(
              "w-full mt-8 py-4 rounded-2xl border-2 font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg",
              darkMode 
                ? "bg-orange-300 border-white text-black" 
                : "bg-orange-400 border-orange-500 text-white"
            )}
          >
            Volver a Hoy
          </button>
        </div>
      </div>
    </div>
  );
}
