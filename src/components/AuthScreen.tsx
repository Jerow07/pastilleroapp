import { useState } from 'react';
import { Lock, Sun, Moon, Eye, EyeOff, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

interface AuthScreenProps {
  onLogin: (code: string, name?: string) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export function AuthScreen({ onLogin, darkMode, toggleDarkMode }: AuthScreenProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim() && name.trim()) {
      onLogin(code.trim().toLowerCase(), name.trim());
    }
  };

  return (
    <div className={cn(
      "min-h-screen font-sans flex items-center justify-center p-4 md:p-8 overflow-x-hidden",
      "bg-[url('/bg.png')] bg-cover bg-center bg-fixed"
    )}>
      {/* Recuadro de la App - Estilo Redondeado Premium */}
      <div className={cn(
        "w-full max-w-md min-h-[90vh] md:h-[850px] flex flex-col items-center justify-center p-6 relative shadow-[0_0_80px_rgba(0,0,0,0.4)] z-10 transition-all duration-500",
        "rounded-[3rem] border-4 border-white/20 overflow-hidden",
        darkMode ? "bg-[#0c141d]/95 text-white" : "bg-[#f0f9ff]/95 text-slate-900"
      )}>
        {/* Header */}
        <div className="fixed top-6 right-6 flex items-center gap-2 z-20">
          <button
            onClick={toggleDarkMode}
            className={cn(
              "p-3 rounded-2xl border-2 transition-all active:scale-95",
              darkMode 
                ? "bg-[#162534] border-orange-300 text-orange-300 shadow-[0_0_15px_rgba(253,186,116,0.2)]" 
                : "bg-white border-orange-100 text-orange-400 shadow-[0_4px_10px_rgba(253,186,116,0.3)]"
            )}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        <div className="w-full max-w-sm">
          {/* Logo Section */}
          <div className="flex flex-col items-center mb-10">
            <div className={cn(
              "w-24 h-24 border-2 rounded-[2.5rem] flex items-center justify-center mb-4 transition-all",
              darkMode 
                ? "bg-black border-orange-300 shadow-[0_0_30px_rgba(253,186,116,0.3)]" 
                : "bg-white border-orange-100 shadow-[0_10px_30px_rgba(253,186,116,0.4)]"
            )}>
              <div className="text-5xl animate-bounce">💊</div>
            </div>
            <h1 className={cn(
              "text-4xl font-black italic tracking-tighter uppercase",
              darkMode ? "text-orange-300" : "text-sky-600"
            )}>Mi Pastillero</h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">Salud en tus manos</p>
          </div>

          {/* Auth Card */}
          <div className={cn(
            "border-2 p-8 rounded-[2.5rem] transition-all",
            darkMode 
              ? "bg-[#162534] border-orange-300 shadow-[0_0_40px_rgba(253,186,116,0.1)]" 
              : "bg-white border-orange-100 shadow-[0_20px_50px_rgba(253,186,116,0.3)]"
          )}>
            <h2 className={cn(
              "text-xl font-black uppercase italic mb-6",
              darkMode ? "text-orange-300" : "text-orange-700"
            )}>¡Bienvenido!</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={cn(
                  "text-[10px] font-black uppercase ml-1 opacity-50",
                  darkMode ? "text-orange-300" : "text-sky-500"
                )}>¿Cómo te llamas?</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Pepito"
                  className={cn(
                    "w-full px-4 py-4 border-2 rounded-2xl font-bold transition-all focus:outline-none mt-1",
                    darkMode 
                      ? "bg-black border-orange-900 text-white focus:border-orange-300 placeholder:text-gray-500" 
                      : "bg-orange-50 border-orange-100 text-orange-900 placeholder:text-orange-300 focus:border-orange-300"
                  )}
                  required
                />
              </div>

              <div>
                <label className={cn(
                  "text-[10px] font-black uppercase ml-1 opacity-50",
                  darkMode ? "text-orange-300" : "text-sky-500"
                )}>Código Secreto</label>
                <div className="relative mt-1">
                  <div className={cn(
                    "absolute left-4 top-1/2 -translate-y-1/2",
                    darkMode ? "text-orange-900" : "text-orange-200"
                  )}>
                    <Lock size={20} strokeWidth={3} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Ej: mi-pastillero"
                    className={cn(
                      "w-full pl-12 pr-12 py-4 border-2 rounded-2xl font-bold transition-all focus:outline-none",
                      darkMode 
                        ? "bg-black border-orange-900 text-white focus:border-orange-300 placeholder:text-gray-500" 
                        : "bg-orange-50 border-orange-100 text-orange-900 placeholder:text-orange-300 focus:border-orange-300"
                    )}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={cn(
                      "absolute right-4 top-1/2 -translate-y-1/2 transition-colors",
                      darkMode ? "text-orange-900 hover:text-orange-300" : "text-orange-200 hover:text-orange-500"
                    )}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className={cn(
                  "w-full py-5 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 mt-4",
                  darkMode 
                    ? "bg-orange-300 border-2 border-white text-black shadow-[0_0_20px_rgba(253,186,116,0.4)]" 
                    : "bg-orange-400 border-2 border-orange-500 text-white shadow-[0_10px_25px_rgba(253,186,116,0.3)]"
                )}
              >
                Entrar al Pastillero <ChevronRight size={20} strokeWidth={3} />
              </button>
            </form>

            <p className={cn(
              "mt-8 text-center text-xs font-bold leading-relaxed uppercase italic",
              darkMode ? "text-gray-600" : "text-gray-400"
            )}>
              Usa el mismo código en todos tus dispositivos para sincronizar tus pastillas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
