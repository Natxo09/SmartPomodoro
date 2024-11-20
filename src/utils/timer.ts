// Interfaces para el estado y configuración del timer
// ! Corregir el sonido inicial al iniciar el audio para movil

export interface TimerState {
    timeLeft: number;  // en segundos
    isActive: boolean;
    mode: 'work' | 'shortBreak' | 'longBreak';
    pomodorosCompleted: number;
}

export interface TimerSettings {
    workTime: number;      // en minutos
    shortBreakTime: number;
    longBreakTime: number;
    notificationSound: boolean;
    autoStartBreaks: boolean;
    autoStartWork: boolean;
}

export class PomodoroTimer {
    private state: TimerState;
    private settings: TimerSettings;
    private timerId: number | null = null;
    private readonly STORAGE_KEY = 'pomodoroState';
    private readonly SETTINGS_KEY = 'pomodoroSettings';
    private tickCallback: (() => void) | null = null;
    private modeChangeCallback: ((mode: TimerState['mode']) => void) | null = null;
    private audioContext: AudioContext | null = null;
    private audioInitialized: boolean = false;
    private workAudio: HTMLAudioElement | null = null;
    private breakAudio: HTMLAudioElement | null = null;

    constructor() {
        // Configuración por defecto
        this.settings = {
            workTime: 25,
            shortBreakTime: 5,
            longBreakTime: 15,
            notificationSound: true,
            autoStartBreaks: false,
            autoStartWork: false
        };

        // Estado inicial
        this.state = {
            timeLeft: this.settings.workTime * 60,
            isActive: false,
            mode: 'work',
            pomodorosCompleted: 0
        };

        // Cargar datos guardados
        this.loadState();
        this.loadSettings();

        // Precargamos los audios
        this.workAudio = new Audio('/smartpomodoro/trabajo.mp3');
        this.breakAudio = new Audio('/smartpomodoro/descanso.mp3');
        this.workAudio.preload = 'auto';
        this.breakAudio.preload = 'auto';
    }

    // Manejadores de eventos
    public onTick(callback: () => void): void {
        this.tickCallback = callback;
    }

    public onModeChange(callback: (mode: TimerState['mode']) => void): void {
        this.modeChangeCallback = callback;
    }

    // Gestión del estado
    private saveState(): void {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
            ...this.state,
            // No guardamos el estado activo al cerrar
            isActive: false
        }));
    }

    private loadState(): void {
        const savedState = localStorage.getItem(this.STORAGE_KEY);
        if (savedState) {
            const parsed = JSON.parse(savedState);
            this.state = { 
                ...this.state, 
                ...parsed,
                // Aseguramos que siempre empiece pausado
                isActive: false 
            };
        }
    }

    private saveSettings(): void {
        try {
            console.log('Guardando nueva configuración en localStorage:', this.settings);
            localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(this.settings));
            // Verificar que se guardó correctamente
            const saved = localStorage.getItem(this.SETTINGS_KEY);
            console.log('Configuración guardada en localStorage:', JSON.parse(saved || '{}'));
        } catch (error) {
            console.error('Error al guardar configuración:', error);
        }
    }

    private loadSettings(): void {
        try {
            const savedSettings = localStorage.getItem(this.SETTINGS_KEY);
            console.log('Cargando configuración desde localStorage:', savedSettings);
            
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                this.settings = {
                    ...this.settings,
                    ...parsed
                };
                console.log('Configuración cargada y aplicada:', this.settings);
            } else {
                console.log('No hay configuración guardada, usando valores por defecto');
            }
        } catch (error) {
            console.error('Error al cargar configuración:', error);
        }
    }

    // Controles del temporizador
    public start(): void {
        console.log('Intentando iniciar timer:', {
            estadoActual: this.state,
            configuración: this.settings
        });
        
        if (!this.state.isActive) {
            this.state.isActive = true;
            this.timerId = window.setInterval(() => this.tick(), 1000);
            this.saveState();
            this.tickCallback?.();
            console.log('Timer iniciado');
        }
    }

    public pause(): void {
        console.log('Intentando pausar timer');
        if (this.state.isActive) {
            this.state.isActive = false;
            if (this.timerId !== null) {
                clearInterval(this.timerId);
                this.timerId = null;
            }
            this.saveState();
            this.tickCallback?.();
            console.log('Timer pausado');
        }
    }

    public reset(): void {
        this.pause();
        this.state.timeLeft = this.getCurrentModeTime() * 60;
        this.saveState();
        this.tickCallback?.();
    }

    public resetSession(): void {
        this.pause();
        this.state = {
            timeLeft: this.settings.workTime * 60,
            isActive: false,
            mode: 'work',
            pomodorosCompleted: 0
        };
        this.saveState();
        this.tickCallback?.();
        this.modeChangeCallback?.('work');
    }

    private tick(): void {
        if (this.state.timeLeft > 0) {
            this.state.timeLeft--;
            if (this.state.timeLeft % 5 === 0) {
                this.saveState();
            }
            this.tickCallback?.();
        } else {
            this.handleTimerComplete();
        }
    }

    private handleTimerComplete(): void {
        console.log('Timer completado. Estado actual:', {
            modo: this.state.mode,
            config: this.settings,
            pomodorosCompleted: this.state.pomodorosCompleted
        });

        this.pause();
        
        // Primero cambiamos el modo para que el sonido corresponda al siguiente período
        const previousMode = this.state.mode;
        
        if (this.state.mode === 'work') {
            this.state.pomodorosCompleted++;
            this.state.mode = this.state.pomodorosCompleted % 4 === 0 ? 'longBreak' : 'shortBreak';
        } else {
            this.state.mode = 'work';
        }

        // Ahora reproducimos el sonido del modo que va a comenzar
        if (this.settings.notificationSound) {
            this.playNotificationSound();
        }

        // Obtener configuración fresca del localStorage
        this.loadSettings();
        
        console.log('Verificando auto-inicio con configuración actual:', {
            modo: this.state.mode,
            configuración: this.settings
        });

        const shouldStart = this.state.mode === 'work' ? 
            this.settings.autoStartWork : 
            this.settings.autoStartBreaks;

        console.log('Decisión de auto-inicio:', {
            modo: this.state.mode,
            debeIniciar: shouldStart,
            configActual: this.settings
        });

        this.state.timeLeft = this.getCurrentModeTime() * 60;
        this.saveState();

        if (previousMode !== this.state.mode) {
            this.modeChangeCallback?.(this.state.mode);
        }

        if (shouldStart) {
            console.log('Iniciando automáticamente en 1 segundo...');
            setTimeout(() => {
                this.loadSettings(); // Recargar configuración antes de auto-iniciar
                const shouldStillStart = this.state.mode === 'work' ? 
                    this.settings.autoStartWork : 
                    this.settings.autoStartBreaks;
                
                if (shouldStillStart) {
                    console.log('Iniciando timer automáticamente');
                    this.start();
                } else {
                    console.log('Auto-inicio cancelado - configuración cambió');
                }
                this.tickCallback?.();
            }, 1000);
        } else {
            console.log('No se inicia automáticamente - configuración desactivada');
            this.tickCallback?.();
        }
    }

    private shouldAutoStart(): boolean {
        const settings = this.getSettings();
        console.log('Comprobando auto-inicio:', {
            modo: this.state.mode,
            configActual: settings
        });

        return this.state.mode === 'work' ? settings.autoStartWork : settings.autoStartBreaks;
    }

    // Gestión de la configuración
    public updateSettings(newSettings: Partial<TimerSettings>): void {
        // Evitar actualizaciones innecesarias comparando valores
        const hasChanges = Object.entries(newSettings).some(([key, value]) => 
            this.settings[key as keyof TimerSettings] !== value
        );

        if (!hasChanges) {
            console.log('No hay cambios en la configuración, omitiendo actualización');
            return;
        }

        console.log('Actualizando configuración:', {
            anterior: { ...this.settings },
            nueva: newSettings
        });
        
        // Actualizar configuración
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();
        
        console.log('Configuración actualizada:', { ...this.settings });
        
        // Si el timer no está activo, actualizar tiempo
        if (!this.state.isActive) {
            this.state.timeLeft = this.getCurrentModeTime() * 60;
            this.saveState();
        }
        
        // Solo llamar al callback si realmente hubo cambios
        this.tickCallback?.();
    }

    private getCurrentModeTime(): number {
        switch (this.state.mode) {
            case 'work':
                return this.settings.workTime;
            case 'shortBreak':
                return this.settings.shortBreakTime;
            case 'longBreak':
                return this.settings.longBreakTime;
        }
    }

    // Notificaciones y sonidos
    private async playNotificationSound(): Promise<void> {
        if (!this.settings.notificationSound) {
            console.log('Sonido desactivado en configuración');
            return;
        }

        try {
            console.log('Intentando reproducir sonido para modo:', this.state.mode);
            
            if (!this.audioInitialized) {
                console.log('Audio no inicializado, intentando inicializar...');
                this.initializeAudio();
            }

            const audio = this.state.mode === 'work' ? this.workAudio : this.breakAudio;
            if (!audio) return;

            audio.volume = 0.5;
            audio.currentTime = 0; // Reiniciar el audio al principio

            try {
                await audio.play();
                console.log('Audio reproducido correctamente');
            } catch (error: unknown) {
                console.error('Error específico reproduciendo audio:', error);
                if (error instanceof Error) {
                    alert(`Error reproduciendo audio: ${error.message}`);
                } else {
                    alert('Error desconocido reproduciendo audio');
                }
            }

        } catch (error: unknown) {
            console.error('Error general en playNotificationSound:', error);
            if (error instanceof Error) {
                alert(`Error general de audio: ${error.message}`);
            } else {
                alert('Error desconocido en el sistema de audio');
            }
        }
    }

    // Inicializar el audio context con interacción del usuario
    public initializeAudio(): void {
        if (this.audioInitialized) {
            console.log('Audio ya inicializado');
            return;
        }
        
        try {
            console.log('Intentando inicializar AudioContext...');
            
            // Intentar reproducir y pausar inmediatamente ambos audios
            const initWorkAudio = this.workAudio?.play().then(() => {
                this.workAudio?.pause();
                this.workAudio!.currentTime = 0;
                this.workAudio!.volume = 0; // Establecer volumen a 0 durante la inicialización
            });

            const initBreakAudio = this.breakAudio?.play().then(() => {
                this.breakAudio?.pause();
                this.breakAudio!.currentTime = 0;
                this.breakAudio!.volume = 0; // Establecer volumen a 0 durante la inicialización
            });

            Promise.all([initWorkAudio, initBreakAudio])
                .then(() => {
                    this.audioInitialized = true;
                    // Restaurar el volumen después de la inicialización
                    if (this.workAudio) this.workAudio.volume = 0.5;
                    if (this.breakAudio) this.breakAudio.volume = 0.5;
                    console.log('Audio inicializado correctamente');
                })
                .catch(err => {
                    console.error('Error inicializando audio:', err);
                    this.audioInitialized = false;
                });
            
        } catch (error: unknown) {
            console.error('Error inicializando audio:', error);
            if (error instanceof Error) {
                alert(`Error inicializando audio: ${error.message}`);
            } else {
                alert('Error desconocido inicializando audio');
            }
        }
    }

    // Getters públicos
    public getState(): TimerState {
        return { ...this.state };
    }

    public getSettings(): TimerSettings {
        return { ...this.settings };
    }

    // Método para limpiar recursos
    public destroy(): void {
        if (this.timerId !== null) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
        this.saveState();
    }
}

// Exportar una instancia única para usar en toda la aplicación
const timer = new PomodoroTimer();
export default timer;