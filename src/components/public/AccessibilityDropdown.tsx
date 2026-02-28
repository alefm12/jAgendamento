import { useState, useEffect } from 'react';
import { ChevronDown, Plus, Minus, SunDim, RotateCcw } from 'lucide-react';

export default function AccessibilityDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [fontSize, setFontSize] = useState(100);
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    const savedFontSize = localStorage.getItem('accessibility-font-size');
    const savedContrast = localStorage.getItem('accessibility-high-contrast');
    
    if (savedFontSize) {
      const size = parseInt(savedFontSize);
      setFontSize(size);
      document.documentElement.style.fontSize = `${size}%`;
    }
    
    if (savedContrast === 'true') {
      setHighContrast(true);
      document.documentElement.classList.add('high-contrast');
    }
  }, []);

  const increaseFontSize = () => {
    if (fontSize < 150) {
      const newSize = fontSize + 10;
      setFontSize(newSize);
      document.documentElement.style.fontSize = `${newSize}%`;
      localStorage.setItem('accessibility-font-size', newSize.toString());
    }
  };

  const decreaseFontSize = () => {
    if (fontSize > 70) {
      const newSize = fontSize - 10;
      setFontSize(newSize);
      document.documentElement.style.fontSize = `${newSize}%`;
      localStorage.setItem('accessibility-font-size', newSize.toString());
    }
  };

  const toggleContrast = () => {
    const newContrast = !highContrast;
    setHighContrast(newContrast);
    
    if (newContrast) {
      document.documentElement.classList.add('high-contrast');
      localStorage.setItem('accessibility-high-contrast', 'true');
    } else {
      document.documentElement.classList.remove('high-contrast');
      localStorage.setItem('accessibility-high-contrast', 'false');
    }
  };

  const resetSettings = () => {
    setFontSize(100);
    setHighContrast(false);
    document.documentElement.style.fontSize = '100%';
    document.documentElement.classList.remove('high-contrast');
    localStorage.removeItem('accessibility-font-size');
    localStorage.removeItem('accessibility-high-contrast');
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center gap-2 rounded-full border border-gray-200/50 bg-white/80 px-4 py-2.5 text-gray-700 shadow-sm backdrop-blur-md transition hover:shadow-md dark:border-gray-700/50 dark:bg-gray-800/80 dark:text-gray-200"
        title="Acessibilidade"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
        <span className="text-sm font-semibold hidden sm:inline">Acessibilidade</span>
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-[60]" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-gray-200/50 bg-white/95 p-4 shadow-xl backdrop-blur-md dark:border-gray-700/50 dark:bg-gray-800/95 z-[70]">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-bold text-gray-700 dark:text-gray-300">
                  Tamanho da Fonte
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={decreaseFontSize}
                    disabled={fontSize <= 70}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600"
                    title="Diminuir fonte"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="flex-1 text-center text-sm font-bold">{fontSize}%</span>
                  <button
                    onClick={increaseFontSize}
                    disabled={fontSize >= 150}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600"
                    title="Aumentar fonte"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold text-gray-700 dark:text-gray-300">
                  Alto Contraste
                </label>
                <button
                  onClick={toggleContrast}
                  className={`flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition ${
                    highContrast
                      ? 'bg-yellow-500 text-black hover:bg-yellow-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  <SunDim size={16} />
                  {highContrast ? 'Desativar' : 'Ativar'}
                </button>
              </div>

              <button
                onClick={resetSettings}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-50 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
              >
                <RotateCcw size={16} />
                Restaurar Padrão
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
