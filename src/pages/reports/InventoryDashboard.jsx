import { useMemo } from 'react'
import { useTable } from '../../lib/useTable'
import { PageHeader, Card, Badge } from '../../components/ui'
import { Package, AlertTriangle, Clock, Ban } from 'lucide-react'

export default function InventoryDashboard() {
  const { rows: items, loading: itemsLoading } = useTable('material_master')
  const { rows: rawBatches } = useTable('raw_material_batches', { select: '*, material_master(item_name, category)' })
  const { rows: fgBatches } = useTable('finished_goods_batches', { select: '*, material_master(item_name)' })

  const stats = useMemo(() => {
    const lowStock = items.filter((i) => (i.reorder_level || 0) > 0).length
    const nearExpiry = fgBatches.filter((b) => {
      if (!b.expiry_date) return false
      const days = (new Date(b.expiry_date) - new Date()) / 86400000
      return days >= 0 && days <= 30
    })
    const outOfStock = items.filter((i) => {
      const totalRemaining = rawBatches.filter((b) => b.item_id === i.id).reduce((sum, b) => sum + (b.remaining_qty || 0), 0)
      return totalRemaining <= 0
    })
    const byCategory = {}
    rawBatches.forEach((b) => {
      const cat = b.material_master?.category || 'Uncategorized'
      byCategory[cat] = (byCategory[cat] || 0) + (b.remaining_qty || 0)
    })
    return { lowStock, nearExpiry, outOfStock, byCategory }
  }, [items, rawBatches, fgBatches])

  return (
    <div>
      <PageHeader title="Inventory Dashboard" description="Live overview of stock health across raw materials and finished goods." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Package} label="Total Items" value={itemsLoading ? '—' : items.length} tone="blue" />
        <StatCard icon={AlertTriangle} label="Items Below Reorder" value={stats.lowStock} tone="amber" />
        <StatCard icon={Clock} label="Near Expiry (FG)" value={stats.nearExpiry.length} tone="amber" />
        <StatCard icon={Ban} label="Out of Stock" value={stats.outOfStock.length} tone="red" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <p className="text-sm font-semibold text-slate-700 mb-3">Stock by Category</p>
          {Object.keys(stats.byCategory).length === 0 ? (
            <p className="text-sm text-slate-400">No stock data yet.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(stats.byCategory).map(([cat, qty]) => (
                <div key={cat} className="flex justify-between text-sm">
                  <span className="text-slate-600">{cat}</span>
                  <span className="font-medium text-slate-800">{qty}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold text-slate-700 mb-3">Batches Near Expiry</p>
          {stats.nearExpiry.length === 0 ? (
            <p className="text-sm text-slate-400">Nothing expiring within 30 days.</p>
          ) : (
            <div className="space-y-2">
              {stats.nearExpiry.map((b) => (
                <div key={b.id} className="flex justify-between text-sm">
                  <span className="text-slate-600">{b.fg_batch_code} — {b.material_master?.item_name}</span>
                  <Badge tone="amber">{b.expiry_date}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, tone }) {
  const tones = { blue: 'text-sky-600 bg-sky-50', amber: 'text-amber-600 bg-amber-50', red: 'text-red-600 bg-red-50', green: 'text-emerald-600 bg-emerald-50' }
  return (
    <Card className="p-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${tones[tone]}`}>
        <Icon size={18} />
      </div>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </Card>
  )
}
