/**
 * Dónde funciona LifeOS. En la web los datos están en el servidor; en la app Android (compilada con
 * `npm run build:app`) viven en una base de datos del propio móvil y no hay servidor ni inicio de sesión.
 */
export const LOCAL_MODE = import.meta.env.VITE_LOCAL === 'true'

export type AppModule = 'agenda' | 'tasks' | 'notes' | 'finance' | 'fitness' | 'habits' | 'goals' | 'reports'

/** Módulos que ya funcionan sin servidor. Los demás no se muestran en la app hasta estar completos. */
const LOCAL_MODULES: readonly AppModule[] = ['tasks']

export function moduleEnabled(module: AppModule): boolean {
  return !LOCAL_MODE || LOCAL_MODULES.includes(module)
}
