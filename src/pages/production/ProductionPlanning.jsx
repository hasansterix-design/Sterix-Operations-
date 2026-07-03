import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useTable } from '../../lib/useTable'
import { supabase } from '../../lib/supabase'
import { generateCode } from '../../lib/codes'
import { PageHeader, Button, Table, EmptyState, Modal, Field, inputClass, Badge, statusTone } from '../../components/ui'
import { Plus, Play, CheckCircle2 } from 'lucide-react'

const EMPTY = { product_id: '', target_qty: '' }

export default function ProductionPlanning() {
  const { can, profile } = useAuth()
  const canEdit = can('production_planning', 'edit')

  const { rows, loading, refresh, update } = useTable('production_orders', {
    select: '*, material_master(item_code, item_name, unit)',
  })
  const { rows: products } = useTable('material_master', { orderBy: 'item_name', ascending: true })

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(null)
  const [actualQty, setActualQty] = useState('')

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    const production_order_no = await generateCode('production_orders_order')
    const batch_code = await generateCode('production_orders_batch')
    const { error } = await supabase.from('production_orders').insert({
      production_order_no, batch_code, product_id: form.product_id,
      target_qty: Number(form.target_qty), created_by: profile?.id,
    })
    setSaving(false)
    if (!error) { setModalOpen(false); setForm(EMPTY); refresh() } else alert(error.message)
  }

  const startOrder = async (row) => {
    await update(row.id, { status: 'in_progress', started_at: new Date().toISOString() })
  }

  const openComplete = (row) => { setCompleting(row); setActualQty(String(row.target_qty)) }

  const submitComplete = async (e) => {
    e.preventDefault()
    const actual = Number(actualQty)
    const yieldPct = completing.target_qty > 0 ? Math.round((actual / completing.target_qty) * 1000) / 10 : null
    await update(completing.id, {
      status: 'completed', actual_qty: actual, yield_percent: yieldPct,
      completed_at: new Date().toISOString(),
    })
    setCompleting(null)
  }

  return (
    <div>
      <PageHeader
        title="Production Planning"
        description="Production orders create the batch that WIP, Sterilization, and Finished Goods will all trace back to."
        action={canEdit && <Button onClick={() => setModalOpen(true)}><Plus size={16} /> New Production Order</Button>}
      />

      <Table columns={['Order No', 'Batch Code', 'Product', 'Target Qty', 'Actual Qty', 'Yield %', 'Status', '']}>
        {loading ? (
          <EmptyState message="Loading..." />
        ) : rows.length === 0 ? (
          <EmptyState message="No production orders yet." />
        ) : (
          rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-800">{r.production_order_no}</td>
              <td className="px-4 py-3 text-slate-600">{r.batch_code}</td>
              <td className="px-4 py-3">{r.material_master?.item_code} — {r.material_master?.item_name}</td>
              <td className="px-4 py-3">{r.target_qty}</td>
              <td className="px-4 py-3">{r.actual_qty || '—'}</td>
              <td className="px-4 py-3">{r.yield_percent ? `${r.yield_percent}%` : '—'}</td>
              <td className="px-4 py-3"><Badge tone={statusTone(r.status)}>{r.status.replace(/_/g, ' ')}</Badge></td>
              <td className="px-4 py-3 text-right">
                {canEdit && r.status === 'planned' && (
                  <button onClick={() => startOrder(r)} title="Start production" className="text-[#024886] hover:text-[#01345f]"><Play size={16} /></button>
                )}
                {canEdit && r.status === 'in_progress' && (
                  <button onClick={() => openComplete(r)} title="Mark complete" className="text-emerald-600 hover:text-emerald-800"><CheckCircle2 size={16} /></button>
                )}
              </td>
            </tr>
          ))
        )}
      </Table>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Production Order">
        <form onSubmit={handleCreate} className="space-y-4">
          <Field label="Product" required>
            <select className={inputClass} required value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
              <option value="">Select product</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.item_code} — {p.item_name}</option>)}
            </select>
          </Field>
          <Field label="Target Quantity" required>
            <input type="number" className={inputClass} required value={form.target_qty} onChange={(e) => setForm({ ...form, target_qty: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Create Order'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!completing} onClose={() => setCompleting(null)} title={`Complete ${completing?.production_order_no || ''}`}>
        {completing && (
          <form onSubmit={submitComplete} className="space-y-4">
            <Field label="Actual Quantity Produced" required>
              <input type="number" className={inputClass} required value={actualQty} onChange={(e) => setActualQty(e.target.value)} />
            </Field>
            <p className="text-xs text-slate-400">Target was {completing.target_qty}. Yield % will be calculated automatically.</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" type="button" onClick={() => setCompleting(null)}>Cancel</Button>
              <Button type="submit">Mark Completed</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
