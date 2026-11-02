import { Navigate, type RouteObject } from 'react-router'

import { LoginPage } from '../auth/LoginPage'
import { RequireAuth } from '../auth/RequireAuth'
import { AgendaPage } from '../features/agenda/AgendaPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { FinancePage } from '../features/finance/FinancePage'
import { FitnessPage } from '../features/fitness/FitnessPage'
import { WorkoutPage } from '../features/fitness/WorkoutPage'
import { GoalsPage } from '../features/goals/GoalsPage'
import { HabitsPage } from '../features/habits/HabitsPage'
import { NotesPage } from '../features/notes/NotesPage'
import { ReportsPage } from '../features/reports/ReportsPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { TasksPage } from '../features/tasks/TasksPage'
import { AppLayout } from '../layout/AppLayout'
import { moduleEnabled, type AppModule } from '../platform'

/** Las pantallas de módulos que aún no funcionan en la app llevan a Hoy (ruta comodín). */
function available(list: (RouteObject & { module: AppModule })[]): RouteObject[] {
  return list.filter((r) => moduleEnabled(r.module)).map(({ path, element }) => ({ path, element }))
}

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          ...available([
            { path: 'agenda', element: <AgendaPage />, module: 'agenda' },
            { path: 'tareas', element: <TasksPage />, module: 'tasks' },
            { path: 'finanzas', element: <FinancePage />, module: 'finance' },
            { path: 'notas', element: <NotesPage />, module: 'notes' },
            { path: 'entreno', element: <FitnessPage />, module: 'fitness' },
            { path: 'entreno/sesion/:id', element: <WorkoutPage />, module: 'fitness' },
            { path: 'habitos', element: <HabitsPage />, module: 'habits' },
            { path: 'objetivos', element: <GoalsPage />, module: 'goals' },
            { path: 'informes', element: <ReportsPage />, module: 'reports' },
          ]),
          { path: 'ajustes', element: <SettingsPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]
