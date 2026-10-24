import type { TFunction } from 'i18next'

import { METRIC_DECIMALS, METRIC_UNITS, METRICS, type CustomMetric, type Measurement } from './api'

/** Una serie de la evolución: una medida fija (peso, cintura…) o un indicador propio. */
export interface Series {
  key: string
  label: string
  short: string
  unit: string
  decimals: number
  value: (entry: Measurement) => number | null
}

export function buildSeries(t: TFunction, customMetrics: CustomMetric[]): Series[] {
  return [
    ...METRICS.map((metric) => ({
      key: metric,
      label: t(`fitness.metrics.${metric}`),
      short: t(`fitness.metricsShort.${metric}`),
      unit: METRIC_UNITS[metric],
      decimals: METRIC_DECIMALS[metric],
      value: (entry: Measurement) => entry[metric],
    })),
    ...customMetrics.map((metric) => ({
      key: metric.id,
      label: metric.name,
      short: metric.name,
      unit: metric.unit ?? '',
      decimals: metric.decimals,
      value: (entry: Measurement) => entry.custom?.[metric.id] ?? null,
    })),
  ]
}

/** «58 ppm», o solo el número si el indicador no tiene unidad. */
export function withUnit(value: string, unit: string) {
  return unit ? `${value} ${unit}` : value
}
