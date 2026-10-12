import { Navigate, type RouteObject } from 'react-router'

import { LoginPage } from '../auth/LoginPage'
import { RequireAuth } from '../auth/RequireAuth'
import { AgendaPage } from '../features/agenda/AgendaPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { FinancePage } from '../features/finance/FinancePage'
import { FitnessPage } from '../features/fitness/FitnessPage'
import { WorkoutPage } from '../features/fitness/WorkoutPage'
import { NotesPage } from '../features/notes/NotesPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { TasksPage } from '../features/tasks/TasksPage'
import { AppLayout } from '../layout/AppLayout'

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'agenda', element: <AgendaPage /> },
          { path: 'tareas', element: <TasksPage /> },
          { path: 'finanzas', element: <FinancePage /> },
          { path: 'notas', element: <NotesPage /> },
          { path: 'entreno', element: <FitnessPage /> },
          { path: 'entreno/sesion/:id', element: <WorkoutPage /> },
          { path: 'ajustes', element: <SettingsPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]
