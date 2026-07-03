import { useMemo } from 'react'
import { useTable } from '../../lib/useTable'
import { PageHeader, Card, Badge, statusTone } from '../../components/ui'
import {
  Boxes, IndianRupee, ShoppingCart, Factory, AlertCircle, Clock3,
  CheckSquare, TrendingUp, Percent
} from 'lucide-react'

export default function MasterDashboard() {
  const { rows: items } = useTable('material_master')
  const { rows: rawBatches } = useTable('raw_material_batches')
  const { rows: prs } = useTable('purchase_requisitions')
  const { rows: pos } = useTable('purchase_orders')
  const { rows: grns } = useTable('grn')
  const { rows: productionOrders } = useTable('production_orders')
  const { rows: poItems } = useTable('purchase_order_items')

  const kpis = useMemo(() => {
    const currentStock = rawBatches.reduce((sum, b) => sum + (b.remaining_qty || 0), 0)
    const purchaseValue = poItems.reduce((sum, i) => sum + (i.unit_price || 0) * (i.ordered_qty || 0), 0)
    const pendingPR = prs.filter((p) => p.status === 'pending').length
    const pendingPO = pos.filter((p) => p.status === 'open').length
    const pendingQC = grns.filter((g) => g.status === 'pending_qc').length
    const completedOrders = productionOrders.filter((p) => p.status === 'completed')
    const avgYield = completedOrders.length > 0
      ? Math.round((completedOrders.reduce((s, o) => s + (o.yield_percent || 0), 0) / completedOrders.length) * 10) / 10
      : null
    const totalTarget = completedOrders.reduce((s, o) => s + (o.target_qty || 0), 0)
    const totalActual = completedOrders.reduce((s, o) => s + (o.actual_qty || 0), 0)
    const wastagePercent = totalTarget > 0 ? Math.round(((totalTarget - totalActual) / totalTarget) * 1000) / 10 : null

    return { currentStock, purchaseValue, pendingPR, pendingPO, pendingQC, avgYield, wastagePercent, productionEfficiency: avgYield }
  }, [rawBatches, prs, pos, grns, productionOrders, poItems])

  return (
    <div>
      <PageHeader title="Master Dashboard" description="Cross-functional snapshot of procurement, production, and quality." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Kpi icon={Boxes} label="Current Stock" value={kpis.currentStock} tone="blue" />
        <Kpi icon={IndianRupee} label="Purchase Value" value={`₹${kpis.purchaseValue.toLocaleString('en-IN')}`} tone="green" />
        <Kpi icon={Clock3} label="Pending PR" value={kpis.pendingPR} tone="amber" />
        <Kpi icon={ShoppingCart} label="Pending PO" value={kpis.pendingPO} tone="amber" />
        <Kpi icon={CheckSquare} label="Pending QC (GRN)" value={kpis.pendingQC} tone="amber" />
        <Kpi icon={Factory} label="Production Orders" value={productionOrders.length} tone="blue" />
        <Kpi icon={TrendingUp} label="Avg Yield %" value={kpis.avgYield !== null ? `${kpis.avgYield}%` : '—'} tone="green" />
        <Kpi icon={Percent} label="Wastage %" value={kpis.wastagePercent !== null ? `${kpis.wastagePercent}%` : '—'} tone="red" />
      </div>

      <Card className="p-5">
        <p className="text-sm font-semibold text-slate-700 mb-3">Recent Production Orders</p>
        {productionOrders.length === 0 ? (
          <p className="text-sm text-slate-400">No production orders yet.</p>
        ) : (
          <div className="space-y-2">
            {productionOrders.slice(0, 8).map((p) => (
              <div key={p.id} className="flex justify-between items-center text-sm border-b border-slate-100 pb-2 last:border-0">
                <span className="text-slate-700">{p.production_order_no} <span className="text-slate-400">({p.batch_code})</span></span>
                <Badge tone={statusTone(p.status)}>{p.status.replace(/_/g, ' ')}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function Kpi({ icon: Icon, label, value, tone }) {
  const tones = { blue: 'text-sky-600 bg-sky-50', amber: 'text-amber-600 bg-amber-50', red: 'text-red-600 bg-red-50', green: 'text-emerald-600 bg-emerald-50' }
  return (
    <Card className="p-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${tones[tone]}`}>
        <Icon size={18} />
      </div>
      <p className="text-xl font-semibold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </Card>
  )
}
