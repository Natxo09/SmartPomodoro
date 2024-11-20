// src/utils/theme.ts
declare global {
  interface Window {
    toggleTheme: () => void;
  }
}

export function setupTheme() {
    // Función para obtener el tema inicial
    function getInitialTheme() {
      const storedTheme = localStorage.getItem('theme');
      if (typeof localStorage !== 'undefined' && storedTheme) {
        return storedTheme;
      }
      
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
  
    // Función para aplicar el tema
    function applyTheme(theme: string) {
      const root = document.documentElement;
      
      if (theme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      
      localStorage.setItem('theme', theme);
    }
  
    // Función para alternar el tema
    function toggleTheme() {
      const currentTheme = localStorage.getItem('theme') || 'light';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      applyTheme(newTheme);
    }
  
    // Inicializar tema
    const initialTheme = getInitialTheme();
    applyTheme(initialTheme);
  
    // Exponer la función de alternar al window para poder usarla en botones
    window.toggleTheme = toggleTheme;
  }