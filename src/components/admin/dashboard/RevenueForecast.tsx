import { useMemo, useState } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { isCancelledOrRefunded } from './orderStatus'

interface Props {
  orders: any[]
}

export function RevenueForecast({ orders }: Props) {
  const [horizon, setHorizon] = useState<'30d' | '60d' | '90d'>('30d')

  const forecast = useMemo(() => {
    const completed = orders.filter((o: any) => !isCancelledOrRefunded(o))
    if (completed.length === 0) return null

    // Group by day
    const dailyRevenue: Record<string, number> = {}
    for (const order of completed) {
      const date = order.createdAt?.slice(0, 10)
      if (date) dailyRevenue[date] = (dailyRevenue[date] || 0) + (order.total || 0)
    }

    const sortedDays = Object.entries(dailyRevenue).sort((a, b) => a[0].localeCompare(b[0]))
    if (sortedDays.length < 3) return null

    // Calculate daily averages
    const dailyAvg = sortedDays.reduce((s, [, v]) => s + v, 0) / sortedDays.length
    const dailyValues = sortedDays.map(([, v]) => v)

    // Simple linear regression
    const n = dailyValues.length
    const xMean = (n - 1) / 2
    const yMean = dailyValues.reduce((s, v) => s + v, 0) / n

    let numerator = 0
    let denominator = 0
    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (dailyValues[i] - yMean)
      denominator += (i - xMean) * (i - xMean)
    }
    const slope = denominator !== 0 ? numerator / denominator : 0
    const intercept = yMean - slope * xMean

    // Trend direction
    const trendDirection = slope > dailyAvg * 0.01 ? 'up' : slope < -dailyAvg * 0.01 ? 'down' : 'stable'

    // Forecast for next N days
    const horizonDays = horizon === '30d' ? 30 : horizon === '60d' ? 60 : 90
    const forecastDays: Array<{ day: number; predicted: number }> = []
    let totalForecast = 0
    for (let i = 0; i < horizonDays; i++) {
      const predicted = Math.max(0, slope * (n + i) + intercept)
      forecastDays.push({ day: i + 1, predicted })
      totalForecast += predicted
    }

    // Weekly forecast
    const weeklyForecast: Array<{ week: string; amount: number }> = []
    for (let w = 0; w < Math.ceil(horizonDays / 7); w++) {
      const weekTotal = forecastDays.slice(w * 7, (w + 1) * 7).reduce((s, d) => s + d.predicted, 0)
      weeklyForecast.push({ week: `Week ${w + 1}`, amount: Math.round(weekTotal) })
    }

    // Last 30 days actual vs forecast comparison
    const last30 = sortedDays.slice(-30)
    const last30Total = last30.reduce((s, [, v]) => s + v, 0)
    const prev30 = sortedDays.slice(-60, -30)
    const prev30Total = prev30.reduce((s, [, v]) => s + v, 0)
    const growthRate = prev30Total > 0 ? ((last30Total - prev30Total) / prev30Total) * 100 : 0

    // Confidence interval (simple std dev based)
    const residuals = dailyValues.map((v, i) => v - (slope * i + intercept))
    const mse = residuals.reduce((s, r) => s + r * r, 0) / n
    const stdDev = Math.sqrt(mse)

    return {
      dailyAvg, slope, trendDirection, totalForecast, horizonDays,
      weeklyForecast, growthRate, last30Total, stdDev,
      forecastDays, dataPoints: n,
    }
  }, [orders, horizon])

  if (!forecast) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-[var(--accent-gold)]" />
          <h2 className="font-display text-sm font-bold text-[var(--text-primary)]">Revenue Forecast</h2>
        </div>
        <p className="text-xs text-[var(--text-muted)] text-center py-6">Need at least 3 days of order data for forecasting</p>
      </div>
    )
  }

  const maxBar = Math.max(...forecast.weeklyForecast.map(w => w.amount))

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-[var(--accent-gold)]" />
          <h2 className="font-display text-sm font-bold text-[var(--text-primary)]">Revenue Forecast</h2>
        </div>
        <div className="flex gap-1">
          {(['30d', '60d', '90d'] as const).map(h => (
            <button key={h} onClick={() => setHorizon(h)}
              className={`rounded-lg px-2 py-0.5 text-[0.5rem] font-bold transition-all ${
                horizon === h ? 'bg-[var(--accent-gold)] text-[var(--btn-blue-text)]' : 'bg-[var(--surface-soft)] text-[var(--text-muted)]'
              }`}>{h}</button>
          ))}
        </div>
      </div>

      {/* Forecast headline */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl bg-[var(--surface-soft)] p-3 text-center">
          <p className="font-mono text-xl font-extrabold text-[var(--text-primary)]">${forecast.totalForecast.toLocaleString()}</p>
          <p className="text-[0.5rem] text-[var(--text-muted)] font-bold uppercase">Forecasted Revenue ({forecast.horizonDays}d)</p>
        </div>
        <div className="rounded-xl bg-[var(--surface-soft)] p-3 text-center">
          <div className="flex items-center justify-center gap-1">
            {forecast.trendDirection === 'up' ? <TrendingUp size={14} className="text-[var(--success)]" /> :
             forecast.trendDirection === 'down' ? <TrendingDown size={14} className="text-[var(--danger)]" /> :
             <Minus size={14} className="text-[var(--text-muted)]" />}
            <p className={`font-mono text-xl font-extrabold ${
              forecast.trendDirection === 'up' ? 'text-[var(--success)]' :
              forecast.trendDirection === 'down' ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]'
            }`}>
              {forecast.growthRate >= 0 ? '+' : ''}{forecast.growthRate.toFixed(1)}%
            </p>
          </div>
          <p className="text-[0.5rem] text-[var(--text-muted)] font-bold uppercase">30d Growth Rate</p>
        </div>
      </div>

      {/* Weekly forecast bar chart */}
      <div className="mb-4">
        <h3 className="text-[0.625rem] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Weekly Forecast</h3>
        <div className="flex items-end gap-1 h-24">
          {forecast.weeklyForecast.slice(0, 12).map((w, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
              <div className="relative w-full flex justify-center">
                <span className="absolute -top-5 hidden group-hover:block text-[0.5rem] font-mono font-bold text-[var(--text-primary)] bg-[var(--surface)] border border-[var(--border)] rounded px-1 py-0.5">
                  ${w.amount.toLocaleString()}
                </span>
              </div>
              <div className="w-full rounded-t bg-[var(--accent-gold)]/60 transition-all hover:bg-[var(--accent-gold)]"
                style={{ height: `${maxBar > 0 ? (w.amount / maxBar) * 100 : 0}%`, minHeight: '2px' }} />
              <span className="text-[0.375rem] text-[var(--text-muted)]">W{i + 1}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-[var(--surface-soft)] p-2 text-center">
          <p className="font-mono text-xs font-bold text-[var(--text-primary)]">${Math.round(forecast.dailyAvg).toLocaleString()}</p>
          <p className="text-[0.5rem] text-[var(--text-muted)]">Daily Avg</p>
        </div>
        <div className="rounded-lg bg-[var(--surface-soft)] p-2 text-center">
          <p className="font-mono text-xs font-bold text-[var(--text-primary)]">±${Math.round(forecast.stdDev).toLocaleString()}</p>
          <p className="text-[0.5rem] text-[var(--text-muted)]">Std Deviation</p>
        </div>
        <div className="rounded-lg bg-[var(--surface-soft)] p-2 text-center">
          <p className="font-mono text-xs font-bold text-[var(--text-primary)]">{forecast.dataPoints}</p>
          <p className="text-[0.5rem] text-[var(--text-muted)]">Data Points</p>
        </div>
      </div>
    </div>
  )
}
