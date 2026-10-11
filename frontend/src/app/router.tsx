import { Navigate, type RouteObject } from 'react-router'

import { LoginPage } from '../auth/LoginPage'
import { RequireAuth } from '../auth/RequireAuth'
import { DashboardPage } from '../features/dashboard/DashboardPage'
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
          { path: 'tareas', element: <TasksPage /> },
          { path: 'ajustes', element: <SettingsPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]
