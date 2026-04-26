import { AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  darkMode?: boolean;
}

export function ConfirmationModal({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  darkMode 
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
      <div className={cn(
        "w-full max-w-sm rounded-[2.5rem] border-4 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200",
        darkMode ? "bg-[#0c141d] border-orange-300 text-white" : "bg-white border-sky-100 text-slate-900"
      )}>
        <div className={cn(
          "p-6 flex flex-col items-center text-center space-y-4",
          darkMode ? "bg-[#162534]/50" : "bg-sky-50/30"
        )}>
          <div className={cn(
            "p-4 rounded-full border-2",
            darkMode ? "bg-red-900/20 border-red-500 text-red-500" : "bg-red-50 border-red-200 text-red-500"
          )}>
            <AlertCircle size={32} strokeWidth={3} />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-black uppercase italic tracking-tight leading-tight">
              {title}
            </h2>
            <p className={cn(
              "text-sm font-bold opacity-70",
              darkMode ? "text-orange-100" : "text-slate-600"
            )}>
              {message}
            </p>
          </div>

          <div className="flex flex-col w-full gap-3 pt-4">
            <button 
              onClick={onConfirm}
              className={cn(
                "w-full py-4 rounded-2xl border-2 font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg",
                darkMode 
                  ? "bg-red-600 border-white text-white" 
                  : "bg-red-500 border-red-600 text-white"
              )}
            >
              Eliminar
            </button>
            <button 
              onClick={onCancel}
              className={cn(
                "w-full py-4 rounded-2xl border-2 font-black uppercase tracking-widest transition-all active:scale-95",
                darkMode 
                  ? "bg-[#162534] border-orange-300 text-orange-300" 
                  : "bg-white border-sky-200 text-sky-600"
              )}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
