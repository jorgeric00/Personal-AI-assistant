import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'

import { SettingsIcon, TodayIcon } from './icons'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
  end?: boolean
}

// Cada módulo nuevo añade aquí su entrada cuando esté disponible.
const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Hoy', icon: <TodayIcon />, end: true },
  { to: '/ajustes', label: 'Ajustes', icon: <SettingsIcon /> },
]

export function AppLayout() {
  return (
    <div className="app-shell">
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>
      <nav className="app-nav" aria-label="Navegación principal">
        <div className="app-nav-brand">
          <img src="/icons/icon-192.png" alt="" width={32} height={32} />
          <span>LifeOS</span>
        </div>
        <ul>
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end} className="app-nav-link">
                {item.icon}
                <span>{item.label}</span>
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
