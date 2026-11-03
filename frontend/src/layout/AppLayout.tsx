import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router'

import type { ParseKeys } from 'i18next'

import { moduleEnabled, type AppModule } from '../platform'
import {
  AgendaIcon,
  FinanceIcon,
  FitnessIcon,
  GoalsIcon,
  HabitsIcon,
  NotesIcon,
  ReportsIcon,
  SettingsIcon,
  TasksIcon,
  TodayIcon,
} from '../ui/icons'

interface NavItem {
  to: string
  label: ParseKeys
  icon: ReactNode
  end?: boolean
  /** En el móvil no cabe en la barra inferior; se llega desde la cabecera de Hoy. */
  desktopOnly?: boolean
  module?: AppModule
}

// Cada módulo nuevo añade aquí su entrada cuando esté disponible.
const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'nav.today', icon: <TodayIcon />, end: true },
  { to: '/agenda', label: 'nav.agenda', icon: <AgendaIcon />, module: 'agenda' },
  { to: '/tareas', label: 'nav.tasks', icon: <TasksIcon />, module: 'tasks' },
  { to: '/notas', label: 'nav.notes', icon: <NotesIcon />, module: 'notes' },
  { to: '/finanzas', label: 'nav.finance', icon: <FinanceIcon />, module: 'finance' },
  { to: '/entreno', label: 'nav.fitness', icon: <FitnessIcon />, module: 'fitness' },
  { to: '/habitos', label: 'nav.habits', icon: <HabitsIcon />, module: 'habits' },
  { to: '/objetivos', label: 'nav.goals', icon: <GoalsIcon />, desktopOnly: true, module: 'goals' },
  { to: '/informes', label: 'nav.reports', icon: <ReportsIcon />, desktopOnly: true, module: 'reports' },
  { to: '/ajustes', label: 'nav.settings', icon: <SettingsIcon />, desktopOnly: true },
]

export function AppLayout() {
  const { t } = useTranslation()
  return (
    <div className="app-shell">
      <a href="#contenido" className="skip-link">
        {t('common.skipToContent')}
      </a>
      <nav className="app-nav" aria-label={t('nav.main')}>
        <div className="app-nav-brand">
          <img src="/icons/icon-192.png" alt="" width={32} height={32} />
          <span>LifeOS</span>
        </div>
        <ul>
          {NAV_ITEMS.filter((item) => !item.module || moduleEnabled(item.module)).map((item) => (
            <li key={item.to} className={item.desktopOnly ? 'desktop-only' : undefined}>
              <NavLink to={item.to} end={item.end} className="app-nav-link">
                {item.icon}
                <span>{t(item.label)}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main id="contenido" className="app-main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  )
}
