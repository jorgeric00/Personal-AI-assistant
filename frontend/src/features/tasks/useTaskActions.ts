import { useTranslation } from 'react-i18next'

import { ApiError } from '../../api/client'
import { useToast } from '../../ui/toast-context'
import { useCompleteTask, useUncompleteTask, type Task } from './api'

/** Completar una tarea con un toque, con aviso para deshacer. */
export function useTaskActions() {
  const { t } = useTranslation()
  const toast = useToast()
  const complete = useCompleteTask()
  const uncomplete = useUncompleteTask()

  const showError = (error: unknown) =>
    toast(error instanceof ApiError ? error.message : t('errors.generic'), { tone: 'error' })

  const completeTask = (task: Task) => {
    const occurrenceDate = task.dueDate
    complete.mutate(
      { id: task.id, occurrenceDate: occurrenceDate as string },
      {
        onSuccess: () =>
          toast(t('tasks.completed'), {
            action: {
              label: t('common.undo'),
              onClick: () =>
                uncomplete.mutate({ id: task.id, occurrenceDate: occurrenceDate as string }, { onError: showError }),
            },
          }),
        onError: showError,
      },
    )
  }

  return { completeTask, isCompleting: (id: string) => complete.isPending && complete.variables?.id === id }
}
