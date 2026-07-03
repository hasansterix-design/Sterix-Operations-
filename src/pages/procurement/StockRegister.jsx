import { useState, useMemo } from 'react'
import { useTable } from '../../lib/useTable'
import { PageHeader, Table, EmptyState, Badge } from '../../components/ui'

export default function StockRegister() {
  const { rows: ledger, loading } = useTable('stock_ledger', {
    select: '*, material_master(item_code, item_name, unit)',
    orderBy: 'txn_date',
    ascending: false,
  })
  const { rows: items } = useTable('material_master', { orderBy: 'item_name', ascending: true })
  const [filterItem, setFilterItem] = useState('')

  const filtered = useMemo(() => {
    if (!filterItem) return ledger
    return ledger.filter((l) => l.item_id === filterItem)
  }, [ledger, filterItem])

  const typeTone = { receipt: 'green', issue: 'red', opening: 'blue', adjustment: 'amber', return: 'slate' }

  return (
    <div>
      <PageHeader
        title="Raw Material Stock Register"
        description="Automatic running ledger of all stock movements — populated by GRN receipts and Material Issues."
      />

      <div className="mb-4">
        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={filterItem}
          onChange={(e) => setFilterItem(e.target.value)}
        >
          <option value="">All items</option>
          {items.map((i) => <option key={i.id} value={i.id}>{i.item_code} — {i.item_name}</option>)}
        </select>
      </div>

      <Table columns={['Date', 'Item', 'Type', 'Quantity', 'Running Balance', 'Reference']}>
        {loading ? (
          <EmptyState message="Loading..." />
        ) : filtered.length === 0 ? (
          <EmptyState message="No stock movements recorded yet." />
        ) : (
          filtered.map((l) => (
            <tr key={l.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 whitespace-nowrap">{l.txn_date}</td>
              <td className="px-4 py-3">
                <span className="font-medium text-slate-800">{l.material_master?.item_code}</span>
                <span className="text-slate-400"> — {l.material_master?.item_name}</span>
              </td>
              <td className="px-4 py-3"><Badge tone={typeTone[l.txn_type]}>{l.txn_type}</Badge></td>
              <td className={`px-4 py-3 font-medium ${l.quantity >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {l.quantity >= 0 ? '+' : ''}{l.quantity} {l.material_master?.unit}
              </td>
              <td className="px-4 py-3">{l.running_balance ?? '—'}</td>
              <td className="px-4 py-3 text-slate-400 text-xs">{l.reference_table || '—'}</td>
            </tr>
          ))
        )}
      </Table>
    </div>
  )
}
