import { useTable } from '../../lib/useTable'
import { PageHeader, Table, EmptyState, Badge, statusTone } from '../../components/ui'

export default function FinishedGoodsInventory() {
  const { rows, loading } = useTable('finished_goods_batches', {
    select: '*, material_master(item_code, item_name, unit)',
  })

  const isNearExpiry = (date) => {
    if (!date) return false
    const days = (new Date(date) - new Date()) / (1000 * 60 * 60 * 24)
    return days >= 0 && days <= 30
  }

  return (
    <div>
      <PageHeader
        title="Finished Goods Inventory"
        description="Stock available for dispatch, by batch. Batches expiring within 30 days are flagged."
      />

      <Table columns={['Batch Code', 'Product', 'Mfg Date', 'Expiry', 'Available', 'Reserved', 'Dispatched', 'QC Status']}>
        {loading ? (
          <EmptyState message="Loading..." />
        ) : rows.length === 0 ? (
          <EmptyState message="No finished goods batches yet." />
        ) : (
          rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-800">{r.fg_batch_code}</td>
              <td className="px-4 py-3">{r.material_master?.item_code} — {r.material_master?.item_name}</td>
              <td className="px-4 py-3 text-slate-500">{r.manufacturing_date || '—'}</td>
              <td className="px-4 py-3">
                {r.expiry_date || '—'} {isNearExpiry(r.expiry_date) && <Badge tone="amber">Near expiry</Badge>}
              </td>
              <td className="px-4 py-3 font-medium text-emerald-700">{r.available_stock} {r.material_master?.unit}</td>
              <td className="px-4 py-3 text-slate-500">{r.reserved_stock} {r.material_master?.unit}</td>
              <td className="px-4 py-3 text-slate-500">{r.dispatched_stock} {r.material_master?.unit}</td>
              <td className="px-4 py-3"><Badge tone={statusTone(r.qc_status)}>{r.qc_status}</Badge></td>
            </tr>
          ))
        )}
      </Table>
    </div>
  )
}
