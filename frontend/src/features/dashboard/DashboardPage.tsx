import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'

import { useCurrentUser } from '../../auth/auth'
import { formatLongDate, greetingKey, todayIso } from '../../lib/date'
import { useDateFormat } from '../../lib/useRelativeDate'
import { PlusIcon, SettingsIcon } from '../../ui/icons'
import { formatMoney } from '../../lib/money'
import { TodayAgenda } from '../agenda/TodayAgenda'
import { useMonthSummary } from '../finance/api'
import { TodayWorkout } from '../fitness/TodayWorkout'
import { TodayHabits } from '../habits/TodayHabits'
import { useNotes } from '../notes/api'
import { NoteCard } from '../notes/NoteCard'
import { useTasks } from '../tasks/api'
import { TaskItem } from '../tasks/TaskItem'
import { useTaskActions } from '../tasks/useTaskActions'

const TODAY_LIMIT = 6
const REMINDERS_LIMIT = 3
const PINNED_LIMIT = 4

function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

export function DashboardPage() {
  const { t } = useTranslation()
  const { data: user } = useCurrentUser()
  const { locale, timeZone, dateTime } = useDateFormat()
  const navigate = useNavigate()
  const now = useNow()
  const greeting = t(greetingKey(now, timeZone))

  const today = useTasks('TODAY')
  const reminders = useTasks('UPCOMING', { kind: 'REMINDER' })
  const pinnedNotes = useNotes('ACTIVE', { pinned: true })
  const month = useMonthSummary(todayIso(timeZone).slice(0, 7))
  const { completeTask, isCompleting } = useTaskActions()
  const openTask = (id: string) => navigate(`/tareas?tarea=${id}`)

  const todayTasks = today.data ?? []
  const nextReminders = (reminders.data ?? []).slice(0, REMINDERS_LIMIT)

  return (
    <div className="page stack-lg">
      <header className="page-header page-header-row">
        <div>
          <p className="eyebrow">{formatLongDate(now, locale, timeZone)}</p>
          <h1 className="h1">{user ? t('greeting.withName', { greeting, name: user.displayName }) : greeting}</h1>
        </div>
        {/* En el móvil Ajustes no cabe en la barra inferior */}
        <Link to="/ajustes" className="icon-button mobile-only" aria-label={t('nav.settings')}>
          <SettingsIcon />
        </Link>
      </header>

      <section aria-labelledby="quick-title" className="stack-sm">
        <h2 id="quick-title" className="visually-hidden">
          {t('dashboard.quickAdd')}
        </h2>
        <div className="quick-actions">
          <Link to="/tareas?nueva=TASK" className="quick-action">
            <PlusIcon />
            {t('tasks.kind.TASK')}
          </Link>
          <Link to="/tareas?nueva=REMINDER" className="quick-action">
            <PlusIcon />
            {t('tasks.kind.REMINDER')}
          </Link>
          <Link to="/agenda?actividad=nueva" className="quick-action">
            <PlusIcon />
            {t('agenda.newShort')}
          </Link>
          <Link to="/notas?nueva=1" className="quick-action">
            <PlusIcon />
            {t('notes.kind')}
          </Link>
          <Link to="/finanzas?nuevo=EXPENSE" className="quick-action">
            <PlusIcon />
            {t('finance.kind.EXPENSE')}
          </Link>
          <Link to="/entreno?vista=FOOD&alimento=nuevo" className="quick-action">
            <PlusIcon />
            {t('nutrition.quickAdd')}
          </Link>
          <Link to="/entreno?vista=PROGRESS&nuevo=1" className="quick-action">
            <PlusIcon />
            {t('fitness.quickAdd')}
          </Link>
        </div>
      </section>

      <section className="stack-sm" aria-labelledby="today-title">
        <div className="section-header">
          <h2 id="today-title" className="h2">
            {t('dashboard.forToday')}
          </h2>
          <Link to="/tareas" className="link">
            {t('common.seeAll')}
          </Link>
        </div>
        {today.isPending ? (
          <div className="card skeleton" aria-hidden="true" />
        ) : todayTasks.length === 0 ? (
          <p className="card muted">{t('dashboard.forTodayEmpty')}</p>
        ) : (
          <>
            <ul className="task-list card">
              {todayTasks.slice(0, TODAY_LIMIT).map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onOpen={() => openTask(task.id)}
                  onComplete={completeTask}
                  completing={isCompleting(task.id)}
                />
              ))}
            </ul>
            {todayTasks.length > TODAY_LIMIT && (
              <Link to="/tareas" className="link">
                {t('dashboard.moreToday', { count: todayTasks.length - TODAY_LIMIT })}
              </Link>
            )}
          </>
        )}
      </section>

      <TodayAgenda />

      <TodayWorkout />

      <TodayHabits />

      <section className="stack-sm" aria-labelledby="reminders-title">
        <h2 id="reminders-title" className="h2">
          {t('dashboard.nextReminders')}
        </h2>
        {reminders.isPending ? (
          <div className="card skeleton" aria-hidden="true" />
        ) : nextReminders.length === 0 ? (
          <p className="card muted">{t('dashboard.nextRemindersEmpty')}</p>
        ) : (
          <ul className="card list-plain reminder-list">
            {nextReminders.map((reminder) => (
              <li key={reminder.id}>
                <button type="button" className="reminder-row" onClick={() => openTask(reminder.id)}>
                  <span className="reminder-when">{dateTime(reminder.dueDate, reminder.dueTime)}</span>
                  <span className="task-title">{reminder.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="stack-sm" aria-labelledby="pinned-title">
        <div className="section-header">
          <h2 id="pinned-title" className="h2">
            {t('dashboard.pinnedNotes')}
          </h2>
          <Link to="/notas" className="link">
            {t('common.seeAll')}
          </Link>
        </div>
        {pinnedNotes.isPending ? (
          <div className="card skeleton" aria-hidden="true" />
        ) : (pinnedNotes.data ?? []).length === 0 ? (
          <p className="card muted">{t('dashboard.pinnedNotesEmpty')}</p>
        ) : (
          <ul className="note-grid list-plain">
            {pinnedNotes.data!.slice(0, PINNED_LIMIT).map((note) => (
              <NoteCard key={note.id} note={note} onOpen={(id) => navigate(`/notas?nota=${id}`)} />
            ))}
          </ul>
        )}
      </section>

      <section className="stack-sm" aria-labelledby="month-title">
        <div className="section-header">
          <h2 id="month-title" className="h2">
            {t('dashboard.thisMonth')}
          </h2>
          <Link to="/finanzas" className="link">
            {t('common.seeAll')}
          </Link>
        </div>
        {month.isPending ? (
          <div className="card skeleton" aria-hidden="true" />
        ) : !month.data || (month.data.totals.incomeCents === 0 && month.data.totals.expenseCents === 0) ? (
          <p className="card muted">{t('dashboard.thisMonthEmpty')}</p>
        ) : (
          <Link to="/finanzas" className="card month-card">
            <span>
              <span className="stat-label">{t('finance.income')}</span>
              <span className="stat-value amount-income">
                {formatMoney(month.data.totals.incomeCents, month.data.currency, locale)}
              </span>
            </span>
            <span>
              <span className="stat-label">{t('finance.expenses')}</span>
              <span className="stat-value amount-expense">
                {formatMoney(month.data.totals.expenseCents, month.data.currency, locale)}
              </span>
            </span>
            <span>
              <span className="stat-label">{t('finance.balance')}</span>
              <span className={`stat-value ${month.data.totals.balanceCents < 0 ? 'amount-expense' : 'amount-income'}`}>
                {formatMoney(month.data.totals.balanceCents, month.data.currency, locale, { signed: true })}
              </span>
            </span>
          </Link>
        )}
      </section>
    </div>
  )
}
