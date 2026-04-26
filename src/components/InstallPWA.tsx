import { useState, useEffect } from 'react';
import { Share2, PlusSquare, Download, X, Smartphone } from 'lucide-react';
import { cn } from '../lib/utils';

export function InstallPWA({ darkMode }: { darkMode?: boolean }) {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // 1. Verificar si ya está instalada (Standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone 
      || document.referrer.includes('android-app://');

    if (isStandalone) {
      console.log('App ya instalada como PWA');
      return;
    }

    // 2. Solo mostrar en dispositivos móviles
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isMobile = /iphone|ipad|ipod|android/.test(userAgent);
    if (!isMobile) return;

    // 3. Verificar si el usuario ya la cerró recientemente
    const dismissed = localStorage.getItem('pillapp_install_dismissed');
    if (dismissed) {
      const lastDismissed = new Date(dismissed).getTime();
      const now = new Date().getTime();
      if (now - lastDismissed < 24 * 60 * 60 * 1000) return; 
    }

    // 4. Configurar Plataforma
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setPlatform('ios');
      // En iOS mostramos después de un delay para no interrumpir
      const timer = setTimeout(() => setShow(true), 4000);
      return () => clearTimeout(timer);
    } else if (/android/.test(userAgent)) {
      setPlatform('android');
      const handler = (e: any) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setShow(true);
      };
      window.addEventListener('beforeinstallprompt', handler);
      return () => window.removeEventListener('beforeinstallprompt', handler);
    }
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShow(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('pillapp_install_dismissed', new Date().toISOString());
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-6 left-4 right-4 z-[100] animate-in slide-in-from-bottom-10 duration-500">
      <div className={cn(
        "p-5 rounded-[2.5rem] border-2 shadow-2xl relative overflow-hidden",
        darkMode ? "bg-[#1c2e3f] border-orange-300 text-white" : "bg-white border-orange-100 text-slate-900 shadow-orange-200/50"
      )}>
        {/* Decoración de fondo */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-400/10 rounded-full blur-3xl" />
        
        <button 
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1 rounded-full opacity-50 hover:opacity-100 transition-opacity"
        >
          <X size={20} />
        </button>

        <div className="flex gap-4 items-start">
          <div className={cn(
            "w-12 h-12 rounded-2xl border-2 flex items-center justify-center flex-shrink-0",
            darkMode ? "bg-orange-300 border-white text-black" : "bg-orange-400 border-orange-500 text-white shadow-lg"
          )}>
            <Smartphone size={24} strokeWidth={3} />
          </div>
          
          <div className="flex-1 pr-6">
            <h3 className="font-black uppercase italic tracking-tight text-sm mb-1">¡Lleva tu Pastillero en el bolsillo!</h3>
            <p className="text-[11px] leading-tight font-medium opacity-80">
              {platform === 'ios' 
                ? 'Toca el botón de "Compartir" y luego "Añadir a la pantalla de inicio" para instalarla.'
                : 'Instala la aplicación en tu pantalla de inicio para acceder más rápido y recibir alertas.'}
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          {platform === 'ios' ? (
            <div className="flex gap-3 items-center w-full bg-orange-50/50 dark:bg-black/20 p-3 rounded-2xl border-2 border-dashed border-orange-200 dark:border-orange-900">
              <div className="flex flex-col items-center gap-1">
                <Share2 size={18} className="text-blue-500" />
                <span className="text-[8px] font-bold uppercase">1. Compartir</span>
              </div>
              <div className="h-8 w-[2px] bg-orange-200 dark:bg-orange-900" />
              <div className="flex flex-col items-center gap-1">
                <PlusSquare size={18} />
                <span className="text-[8px] font-bold uppercase text-center leading-tight">2. Añadir a<br/>inicio</span>
              </div>
              <div className="flex-1 text-[10px] italic font-bold text-right text-orange-600 dark:text-orange-300 pr-2">
                ¡Así de fácil! ✨
              </div>
            </div>
          ) : (
            <button
              onClick={handleInstall}
              className={cn(
                "w-full py-3 rounded-2xl border-2 font-black uppercase text-xs flex items-center justify-center gap-2 transition-all active:scale-95",
                darkMode ? "bg-orange-300 border-white text-black" : "bg-orange-400 border-orange-500 text-white shadow-md"
              )}
            >
              <Download size={16} strokeWidth={3} />
              Instalar Aplicación
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
