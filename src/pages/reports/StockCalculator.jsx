import { useState } from 'react'
import { useTable } from '../../lib/useTable'
import { PageHeader, Card, Table, EmptyState, Field, inputClass, Button } from '../../components/ui'
import { Calculator } from 'lucide-react'

export default function StockCalculator() {
  const { rows: items, loading } = useTable('material_master', { orderBy: 'item_name', ascending: true })

  const [avgConsumption, setAvgConsumption] = useState('')
  const [leadTime, setLeadTime] = useState('')
  const [safetyFactor, setSafetyFactor] = useState('1.5')
  const [result, setResult] = useState(null)

  const calculate = (e) => {
    e.preventDefault()
    const avg = Number(avgConsumption)
    const lead = Number(leadTime)
    const factor = Number(safetyFactor)
    const leadTimeConsumption = avg * lead
    const safetyStock = Math.round(leadTimeConsumption * (factor - 1))
    const reorderLevel = Math.round(leadTimeConsumption + safetyStock)
    const minStock = safetyStock
    const maxStock = Math.round(reorderLevel * 1.5)
    setResult({ leadTimeConsumption, safetyStock, reorderLevel, minStock, maxStock })
  }

  return (
    <div>
      <PageHeader
        title="Stock Level Calculator"
        description="Calculate minimum stock, safety stock, and reorder level from average consumption and lead time."
      />

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <p className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2"><Calculator size={16} /> Calculator</p>
          <form onSubmit={calculate} className="space-y-4">
            <Field label="Average Daily Consumption" required>
              <input type="number" className={inputClass} required value={avgConsumption} onChange={(e) => setAvgConsumption(e.target.value)} placeholder="e.g. 500" />
            </Field>
            <Field label="Lead Time (days)" required>
              <input type="number" className={inputClass} required value={leadTime} onChange={(e) => setLeadTime(e.target.value)} placeholder="e.g. 10" />
            </Field>
            <Field label="Safety Factor (multiplier on lead-time demand)">
              <input type="number" step="0.1" className={inputClass} value={safetyFactor} onChange={(e) => setSafetyFactor(e.target.value)} />
            </Field>
            <Button type="submit">Calculate</Button>
          </form>

          {result && (
            <div className="mt-5 pt-5 border-t border-slate-100 space-y-2 text-sm">
              <Row label="Lead Time Consumption" value={result.leadTimeConsumption} />
              <Row label="Safety Stock" value={result.safetyStock} />
              <Row label="Reorder Level" value={result.reorderLevel} highlight />
              <Row label="Minimum Stock" value={result.minStock} />
              <Row label="Maximum Stock" value={result.maxStock} />
            </div>
          )}
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold text-slate-700 mb-4">Reference Example (from your flow chart)</p>
          <Table columns={['Item', 'Avg Daily Consumption', 'Lead Time', 'Safety Stock', 'Reorder Level']}>
            <tr>
              <td className="px-4 py-3 font-medium">Barrel</td>
              <td className="px-4 py-3">500</td>
              <td className="px-4 py-3">10 Days</td>
              <td className="px-4 py-3">2000</td>
              <td className="px-4 py-3">7000</td>
            </tr>
          </Table>
        </Card>
      </div>

      <Card className="p-5 mt-6">
        <p className="text-sm font-semibold text-slate-700 mb-3">Current Stock Settings by Item</p>
        <Table columns={['Item', 'Avg Daily Consumption', 'Lead Time (days)', 'Safety Stock', 'Reorder Level', 'Max Level']}>
          {loading ? (
            <EmptyState message="Loading..." />
          ) : items.length === 0 ? (
            <EmptyState message="No items in Material Master yet." />
          ) : (
            items.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-3 font-medium">{i.item_code} — {i.item_name}</td>
                <td className="px-4 py-3">{i.avg_daily_consumption ?? '—'}</td>
                <td className="px-4 py-3">{i.lead_time_days ?? '—'}</td>
                <td className="px-4 py-3">{i.safety_stock ?? '—'}</td>
                <td className="px-4 py-3">{i.reorder_level ?? '—'}</td>
                <td className="px-4 py-3">{i.max_level ?? '—'}</td>
              </tr>
            ))
          )}
        </Table>
        <p className="text-xs text-slate-400 mt-2">These values are set per item in Material Master and used to drive reorder alerts on the dashboards.</p>
      </Card>
    </div>
  )
}

function Row({ label, value, highlight }) {
  return (
    <div className={`flex justify-between ${highlight ? 'font-semibold text-[#024886]' : 'text-slate-600'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
