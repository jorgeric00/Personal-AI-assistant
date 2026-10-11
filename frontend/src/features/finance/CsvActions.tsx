import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '../../api/client'
import { useToast } from '../../ui/toast-context'
import { exportUrl, useImportCsv, type ImportResult, type MovementFilters } from './api'

/**
 * Exportar el historial (respetando el intervalo de fechas filtrado) e importar un CSV. La importación es todo o
 * nada: si alguna línea tiene errores no se guarda ninguna y se listan para corregirlas.
 */
export function CsvActions({ filters }: { filters: MovementFilters }) {
  const { t } = useTranslation()
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const importCsv = useImportCsv()
  const [result, setResult] = useState<ImportResult | null>(null)

  const onFile = (file: File | undefined) => {
    if (!file) return
    setResult(null)
    importCsv.mutate(file, {
      onSuccess: (data) => {
        setResult(data)
        if (data.errors.length === 0) toast(t('finance.csv.imported', { count: data.imported }))
      },
      onError: (e) => toast(e instanceof ApiError ? e.message : t('errors.generic'), { tone: 'error' }),
      onSettled: () => {
        if (input.current) input.current.value = ''
      },
    })
  }

  const ranged = Boolean(filters.from || filters.to)
  return (
    <section className="stack-sm" aria-labelledby="csv-title">
      <h2 id="csv-title" className="h3">
        {t('finance.csv.title')}
      </h2>
      <div className="csv-actions">
        <a className="button button-secondary button-small" href={exportUrl(filters)} download>
          {t(ranged ? 'finance.csv.exportRange' : 'finance.csv.export')}
        </a>
        <button
          type="button"
          className="button button-secondary button-small"
          disabled={importCsv.isPending}
          onClick={() => input.current?.click()}
        >
          {importCsv.isPending ? t('finance.csv.importing') : t('finance.csv.import')}
        </button>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          hidden
          data-testid="csv-file"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>
      <p className="muted small">{t('finance.csv.help')}</p>

      {result && result.errors.length > 0 && (
        <div className="alert alert-error stack-sm" role="alert">
          <p>{t('finance.csv.failed', { count: result.errors.length })}</p>
          <ul className="import-errors">
            {result.errors.map((error) => (
              <li key={`${error.line}-${error.message}`}>
                {t('finance.csv.line', { line: error.line })}: {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {result && result.errors.length === 0 && (
        <div className="alert alert-info" role="status">
          {[
            t('finance.csv.imported', { count: result.imported }),
            result.skippedDuplicates > 0 && t('finance.csv.duplicates', { count: result.skippedDuplicates }),
            result.createdCategories.length > 0 &&
              t('finance.csv.newCategories', { names: result.createdCategories.join(', ') }),
            result.createdAccounts.length > 0 && t('finance.csv.newAccounts', { names: result.createdAccounts.join(', ') }),
          ]
            .filter(Boolean)
            .join(' ')}
        </div>
      )}
    </section>
  )
}
