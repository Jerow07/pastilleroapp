import { useState } from 'react';
import type { Pill } from '../lib/types';
import { X, Clock, Calendar, Check, Plus } from 'lucide-react';
import { cn } from '../lib/utils';

interface AddPillModalProps {
  onSave: (pill: Pill) => void;
  onClose: () => void;
  darkMode?: boolean;
  pill?: Pill; // Si viene una pill, estamos editando
}

const EMOJIS = ['💊', '🧪', '💉', '🧴'];
const COLORS = [
  'bg-orange-300', 
  'bg-blue-300', 
  'bg-indigo-300', 
  'bg-green-300', 
  'bg-pink-300', 
  'bg-yellow-300', 
  'bg-purple-300', 
  'bg-red-300'
];

const EMOJI_LABELS: Record<string, { label: string, gender: 'm' | 'f' }> = {
  '💊': { label: 'Pastilla', gender: 'f' },
  '🧪': { label: 'Jarabe', gender: 'm' },
  '💉': { label: 'Inyección', gender: 'f' },
  '🧴': { label: 'Emulsión', gender: 'f' }
};

export function AddPillModal({ onSave, onClose, darkMode, pill }: AddPillModalProps) {
  const [name, setName] = useState(pill?.name || '');
  const [dose, setDose] = useState(pill?.dose || '');
  const [times, setTimes] = useState<string[]>(pill?.times || (pill?.time ? [pill.time] : ['08:00']));
  const [frequency, setFrequency] = useState<'daily' | 'specific_days'>(pill?.frequency || 'daily');
  const [selectedDays, setSelectedDays] = useState<number[]>(pill?.selectedDays || [1, 2, 3, 4, 5]);
  const [selectedEmoji, setSelectedEmoji] = useState(pill?.emoji || EMOJIS[0]);
  const [selectedColor] = useState(pill?.color || COLORS[0]);

  // Estados de Stock (Baúl)
  const [stockEnabled, setStockEnabled] = useState(pill?.stockEnabled || false);
  const [totalStock, setTotalStock] = useState(pill?.totalStock?.toString() || '0');
  const [quantityPerDose, setQuantityPerDose] = useState(pill?.quantityPerDose?.toString() || '1');
  const [unit, setUnit] = useState(pill?.unit || 'pastillas');

  const currentType = EMOJI_LABELS[selectedEmoji] || { label: 'Medicamento', gender: 'm' };
  const actionText = pill ? 'Editar' : (currentType.gender === 'f' ? 'Nueva' : 'Nuevo');

  const days = [
    { id: 1, label: 'L' },
    { id: 2, label: 'M' },
    { id: 3, label: 'M' },
    { id: 4, label: 'J' },
    { id: 5, label: 'V' },
    { id: 6, label: 'S' },
    { id: 0, label: 'D' },
  ];

  const handleSave = () => {
    if (!name.trim() || times.length === 0) return;

    const newPill: Pill = {
      id: pill?.id || Math.random().toString(36).substring(2, 10),
      name: name.trim(),
      dose: dose.trim(),
      time: times[0], // Sigue existiendo para compatibilidad
      times: [...times].sort(),
      takenDates: pill?.takenDates || [],
      frequency,
      selectedDays: frequency === 'specific_days' ? selectedDays : [],
      createdAt: pill?.createdAt || new Date().toISOString(),
      emoji: selectedEmoji,
      color: selectedColor,
      stockEnabled,
      totalStock: stockEnabled ? (parseFloat(totalStock) || 0) : undefined,
      quantityPerDose: stockEnabled ? (parseFloat(quantityPerDose) || 1) : undefined,
      unit: stockEnabled ? unit : undefined
    };

    onSave(newPill);
    onClose();
  };

  const addTime = () => setTimes([...times, '08:00']);
  const removeTime = (index: number) => setTimes(times.filter((_, i) => i !== index));
  const updateTime = (index: number, val: string) => {
    const newTimes = [...times];
    newTimes[index] = val;
    setTimes(newTimes);
  };

  const toggleDay = (dayId: number) => {
    if (selectedDays.includes(dayId)) {
      setSelectedDays(selectedDays.filter(id => id !== dayId));
    } else {
      setSelectedDays([...selectedDays, dayId]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className={cn(
        "w-full max-w-lg rounded-[3rem] border-2 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300",
        darkMode ? "bg-[#162534] border-orange-300 text-white" : "bg-white border-orange-100 text-slate-900"
      )}>
        <div className={cn(
          "p-6 border-b-2 flex justify-between items-center",
          darkMode ? "bg-[#1c2e3f] border-orange-300" : "bg-orange-50 border-orange-100"
        )}>
          <h2 className="text-2xl font-black uppercase italic tracking-tight">
            {actionText} {currentType.label}
          </h2>
          <button onClick={onClose} className={cn(
            "p-2 border-2 rounded-full transition-all active:scale-90",
            darkMode ? "bg-[#162534] border-orange-300 text-orange-300" : "bg-white border-orange-100 text-orange-400"
          )}>
            <X size={24} strokeWidth={3} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto pb-20">
          <div className="flex flex-col gap-4">
            <div className="flex justify-center mb-2">
              <div className={cn(
                "w-24 h-24 rounded-3xl border-2 flex items-center justify-center text-5xl transition-all",
                darkMode ? "bg-[#1c2e3f] border-orange-300 shadow-[0_0_15px_rgba(253,186,116,0.3)]" : "bg-orange-50 border-orange-100 text-orange-400"
              )}>
                {selectedEmoji}
              </div>
            </div>
            
            <div className="flex flex-wrap justify-center gap-2">
              {EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => setSelectedEmoji(emoji)}
                  className={cn(
                    "w-12 h-12 text-xl flex items-center justify-center border-2 rounded-2xl transition-all",
                    selectedEmoji === emoji 
                      ? (darkMode ? "bg-orange-300 border-white text-black scale-110 shadow-[0_0_10px_rgba(253,186,116,0.5)]" : "bg-orange-400 border-orange-500 text-white scale-110") 
                      : (darkMode ? "bg-[#162534] border-orange-900 text-orange-900" : "bg-white border-orange-100 text-orange-200 hover:bg-orange-50")
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className={cn("block text-xs font-black uppercase mb-1 ml-1", darkMode ? "text-orange-300" : "text-sky-600")}>Nombre</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Vitamina C"
                className={cn(
                  "w-full px-4 py-4 border-2 rounded-2xl font-bold focus:outline-none transition-all",
                  darkMode 
                    ? "bg-[#1c2e3f] border-orange-900 text-white focus:border-orange-300 placeholder:text-gray-700" 
                    : "bg-orange-50/50 border-orange-100 text-slate-800 placeholder:text-orange-200 focus:border-orange-300"
                )}
              />
            </div>

            <div className="p-4 border-2 rounded-[2rem] bg-black/5 space-y-4">
              <label className={cn("block text-xs font-black uppercase mb-1 ml-1 flex items-center gap-1", darkMode ? "text-orange-300" : "text-sky-600")}>
                <Clock size={12} strokeWidth={3} /> Horarios de toma
              </label>
              <div className="grid grid-cols-1 gap-2">
                {times.map((t, i) => (
                  <div key={i} className="flex gap-2 animate-in slide-in-from-left-2 duration-200">
                    <input
                      type="time"
                      value={t}
                      onChange={(e) => updateTime(i, e.target.value)}
                      className={cn(
                        "flex-1 px-4 py-3 border-2 rounded-2xl font-black focus:outline-none transition-all",
                        darkMode ? "bg-[#1c2e3f] border-orange-900 text-white focus:border-orange-300" : "bg-white border-orange-100 text-slate-800 shadow-sm"
                      )}
                    />
                    {times.length > 1 && (
                      <button 
                        onClick={() => removeTime(i)}
                        className={cn(
                          "px-4 border-2 rounded-2xl transition-all active:scale-90",
                          darkMode ? "bg-red-900/20 border-red-900 text-red-500" : "bg-red-50 border-red-100 text-red-500"
                        )}
                      >
                        <X size={20} />
                      </button>
                    )}
                  </div>
                ))}
                <button 
                  onClick={addTime}
                  className={cn(
                    "w-full py-4 border-2 border-dashed rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 transition-all active:scale-95 mt-2",
                    darkMode ? "bg-orange-300/10 border-orange-300 text-orange-300" : "bg-orange-100 border-orange-400 text-orange-600 shadow-sm"
                  )}
                >
                  <Plus size={16} strokeWidth={4} /> AGREGAR OTRO HORARIO
                </button>
              </div>
            </div>

            <div>
              <label className={cn("block text-xs font-black uppercase mb-1 ml-1", darkMode ? "text-orange-300" : "text-sky-600")}>Dosis / Cantidad</label>
              <input
                type="text"
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                placeholder="Ej: 1 cápsula, 5ml..."
                className={cn(
                  "w-full px-4 py-4 border-2 rounded-2xl font-bold focus:outline-none transition-all",
                  darkMode 
                    ? "bg-[#1c2e3f] border-orange-900 text-white focus:border-orange-300 placeholder:text-gray-700" 
                    : "bg-orange-50/50 border-orange-100 text-slate-800 placeholder:text-orange-200 focus:border-orange-300"
                )}
              />
            </div>

            <div>
              <label className={cn("block text-xs font-black uppercase mb-1 ml-1 flex items-center gap-1", darkMode ? "text-orange-300" : "text-sky-600")}>
                <Calendar size={12} strokeWidth={3} /> Frecuencia
              </label>
              <div className={cn("flex border-2 rounded-2xl overflow-hidden h-[58px]", darkMode ? "border-orange-900" : "border-orange-100")}>
                <button
                  onClick={() => setFrequency('daily')}
                  className={cn(
                    "flex-1 text-[10px] font-black uppercase transition-all",
                    frequency === 'daily' 
                      ? (darkMode ? "bg-orange-300 text-black" : "bg-orange-400 text-white") 
                      : (darkMode ? "bg-[#162534] text-orange-900 hover:text-orange-300" : "bg-white text-orange-200 hover:bg-orange-50")
                  )}
                >
                  Diaria
                </button>
                <button
                  onClick={() => setFrequency('specific_days')}
                  className={cn(
                    "flex-1 text-[10px] font-black uppercase transition-all",
                    frequency === 'specific_days' 
                      ? (darkMode ? "bg-orange-300 text-black" : "bg-orange-400 text-white") 
                      : (darkMode ? "bg-[#162534] text-orange-900 hover:text-orange-300" : "bg-white text-orange-200 hover:bg-orange-50")
                  )}
                >
                  Días
                </button>
              </div>
            </div>

            {frequency === 'specific_days' && (
              <div className="animate-in slide-in-from-top-2 duration-200">
                <label className={cn("block text-xs font-black uppercase mb-2 ml-1", darkMode ? "text-orange-300" : "text-sky-600")}>Días seleccionados</label>
                <div className="flex justify-between gap-1">
                  {days.map((day) => (
                    <button
                      key={day.id}
                      onClick={() => toggleDay(day.id)}
                      className={cn(
                        "w-10 h-10 rounded-xl border-2 font-black text-xs transition-all active:scale-90",
                        selectedDays.includes(day.id)
                          ? (darkMode ? "bg-orange-300 border-white text-black shadow-[0_0_10px_rgba(253,186,116,0.3)]" : "bg-orange-400 border-orange-500 text-white shadow-[0_4px_10px_rgba(253,186,116,0.2)]")
                          : (darkMode ? "bg-[#1c2e3f] border-orange-900 text-orange-900" : "bg-white border-orange-50 text-orange-200")
                      )}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sección Baúl (Stock) */}
          <div className={cn(
            "p-5 border-2 rounded-[2rem] transition-all",
            darkMode 
              ? (stockEnabled ? "bg-orange-300/5 border-orange-300" : "bg-black/20 border-orange-900 opacity-60") 
              : (stockEnabled ? "bg-orange-50 border-orange-200" : "bg-gray-50 border-orange-100 opacity-60")
          )}>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "p-2 border-2 rounded-xl",
                  darkMode ? "bg-[#1c2e3f] border-orange-300" : "bg-white border-orange-100 shadow-sm"
                )}>
                  <Plus size={18} strokeWidth={3} className={darkMode ? "text-orange-300" : "text-orange-400"} />
                </div>
                <h3 className="font-black uppercase italic tracking-tight">Activar Baúl</h3>
              </div>
              <button 
                onClick={() => setStockEnabled(!stockEnabled)}
                className={cn(
                  "w-12 h-6 rounded-full border-2 transition-all relative",
                  stockEnabled 
                    ? (darkMode ? "bg-orange-300 border-white" : "bg-orange-400 border-orange-500") 
                    : (darkMode ? "bg-gray-800 border-gray-600" : "bg-gray-200 border-orange-100")
                )}
              >
                <div className={cn(
                  "w-4 h-4 rounded-full border-2 absolute top-0.5 transition-all",
                  stockEnabled ? "right-1 bg-white border-black" : "left-1 bg-gray-400 border-orange-200"
                )} />
              </button>
            </div>

            {stockEnabled && (
              <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={cn("block text-[10px] font-black uppercase mb-1 ml-1", darkMode ? "text-orange-300" : "text-orange-500")}>Total en Baúl</label>
                    <input
                      type="number"
                      value={totalStock}
                      onChange={(e) => setTotalStock(e.target.value)}
                      className={cn(
                        "w-full px-3 py-2 border-2 rounded-xl font-bold focus:outline-none transition-all",
                        darkMode ? "bg-[#162534] border-orange-900 text-white focus:border-orange-300" : "bg-white border-orange-100 text-slate-800"
                      )}
                    />
                  </div>
                  <div>
                    <label className={cn("block text-[10px] font-black uppercase mb-1 ml-1", darkMode ? "text-orange-300" : "text-orange-500")}>Unidad</label>
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className={cn(
                        "w-full px-3 py-2 border-2 rounded-xl font-bold focus:outline-none transition-all h-[44px]",
                        darkMode ? "bg-[#162534] border-orange-900 text-white focus:border-orange-300" : "bg-white border-orange-100 text-slate-800"
                      )}
                    >
                      <option value="pastillas">Pastillas</option>
                      <option value="mg">mg</option>
                      <option value="ml">ml</option>
                      <option value="gotas">Gotas</option>
                      <option value="puff">Puff (Spray)</option>
                      <option value="aplicaciones">Aplicaciones (Crema)</option>
                      <option value="dosis">Dosis</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={cn("block text-[10px] font-black uppercase mb-1 ml-1", darkMode ? "text-orange-300" : "text-orange-500")}>Cada toma resta:</label>
                  <input
                    type="number"
                    value={quantityPerDose}
                    onChange={(e) => setQuantityPerDose(e.target.value)}
                    className={cn(
                      "w-full px-3 py-2 border-2 rounded-xl font-bold focus:outline-none transition-all",
                      darkMode ? "bg-[#162534] border-orange-900 text-white focus:border-orange-300" : "bg-white border-orange-100 text-slate-800"
                    )}
                  />
                  <p className="text-[9px] font-bold text-gray-500 mt-1 italic ml-1">
                    * El stock se descontará automáticamente cada vez que marques una toma.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={cn("p-6 border-t-2", darkMode ? "bg-[#162534] border-orange-300" : "bg-orange-50 border-orange-100")}>
          <button
            onClick={handleSave}
            disabled={!name.trim() || times.length === 0}
            className={cn(
              "w-full py-5 rounded-3xl border-2 font-black uppercase tracking-widest text-lg flex items-center justify-center gap-2 transition-all active:scale-95",
              name.trim() && times.length > 0
                ? (darkMode ? "bg-orange-300 border-white text-black shadow-[0_0_20px_rgba(253,186,116,0.4)]" : "bg-orange-400 border-orange-500 text-white shadow-[0_4px_15px_rgba(253,186,116,0.3)]") 
                : "bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed shadow-none"
            )}
          >
            <Check size={24} strokeWidth={4} />
            Guardar {currentType.label}
          </button>
        </div>
      </div>
    </div>
  );
}
