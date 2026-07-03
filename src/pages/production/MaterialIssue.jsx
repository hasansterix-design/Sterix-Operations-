import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useTable } from '../../lib/useTable'
import { supabase } from '../../lib/supabase'
import { generateCode } from '../../lib/codes'
import { PageHeader, Button, Table, EmptyState, Modal, Field, inputClass } from '../../components/ui'
import { Plus } from 'lucide-react'

const EMPTY = { department: '', production_order_id: '', item_id: '', batch_id: '', quantity: '' }

export default function MaterialIssue() {
  const { can, profile } = useAuth()
  const canEdit = can('material_issue', 'edit')

  const { rows, loading, refresh } = useTable('material_issues', {
    select: '*, material_master(item_code, item_name, unit), raw_material_batches(batch_code), production_orders(production_order_no, batch_code)',
  })
  const { rows: items } = useTable('material_master', { orderBy: 'item_name', ascending: true })
  const { rows: productionOrders } = useTable('production_orders', {
    filter: (q) => q.in('status', ['planned', 'in_progress']),
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [availableBatches, setAvailableBatches] = useState([])
  const [saving, setSaving] = useState(false)

  const loadBatches = async (itemId) => {
    setForm((f) => ({ ...f, item_id: itemId, batch_id: '' }))
    if (!itemId) { setAvailableBatches([]); return }
    const { data } = await supabase
      .from('raw_material_batches')
      .select('id, batch_code, remaining_qty')
      .eq('item_id', itemId).eq('qc_status', 'approved').gt('remaining_qty', 0)
    setAvailableBatches(data || [])
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const issue_no = await generateCode('material_issues')
    const qty = Number(form.quantity)

    const { error } = await supabase.from('material_issues').insert({
      issue_no, department: form.department,
      production_order_id: form.production_order_id || null,
      item_id: form.item_id, batch_id: form.batch_id || null,
      quantity: qty, issued_by: profile?.id,
    })

    if (error) { setSaving(false); alert(error.message); return }

    if (form.batch_id) {
      const batch = availableBatches.find((b) => b.id === form.batch_id)
      if (batch) {
        await supabase.from('raw_material_batches').update({
          remaining_qty: Math.max(0, batch.remaining_qty - qty),
        }).eq('id', form.batch_id)
      }
      if (form.production_order_id) {
        await supabase.from('production_batch_consumption').insert({
          production_order_id: form.production_order_id,
          raw_material_batch_id: form.batch_id,
          quantity_consumed: qty,
        })
      }
    }

    const { data: lastEntry } = await supabase
      .from('stock_ledger').select('running_balance').eq('item_id', form.item_id)
      .order('txn_date', { ascending: false }).limit(1).maybeSingle()
    const prevBalance = lastEntry?.running_balance || 0

    await supabase.from('stock_ledger').insert({
      item_id: form.item_id, txn_type: 'issue', quantity: -qty,
      reference_table: 'material_issues', batch_id: form.batch_id || null,
      running_balance: prevBalance - qty, created_by: profile?.id,
    })

    setSaving(false)
    setModalOpen(false)
    setForm(EMPTY)
    refresh()
  }

  return (
    <div>
      <PageHeader
        title="Material Issue"
        description="Issue approved raw material batches to a production order. Reduces batch balance and stock ledger."
        action={canEdit && <Button onClick={() => setModalOpen(true)}><Plus size={16} /> New Issue</Button>}
      />

      <Table columns={['Issue No', 'Department', 'Production Order', 'Item', 'Batch', 'Quantity']}>
        {loading ? (
          <EmptyState message="Loading..." />
        ) : rows.length === 0 ? (
          <EmptyState message="No material issues yet." />
        ) : (
          rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-800">{r.issue_no}</td>
              <td className="px-4 py-3">{r.department}</td>
              <td className="px-4 py-3 text-slate-500">{r.production_orders?.production_order_no || '—'}</td>
              <td className="px-4 py-3">{r.material_master?.item_code} — {r.material_master?.item_name}</td>
              <td className="px-4 py-3 text-slate-500">{r.raw_material_batches?.batch_code || '—'}</td>
              <td className="px-4 py-3">{r.quantity} {r.material_master?.unit}</td>
            </tr>
          ))
        )}
      </Table>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Material Issue">
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Department" required>
            <input className={inputClass} required value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          </Field>
          <Field label="Production Order">
            <select className={inputClass} value={form.production_order_id} onChange={(e) => setForm({ ...form, production_order_id: e.target.value })}>
              <option value="">— None —</option>
              {productionOrders.map((p) => <option key={p.id} value={p.id}>{p.production_order_no} ({p.batch_code})</option>)}
            </select>
          </Field>
          <Field label="Item" required>
            <select className={inputClass} required value={form.item_id} onChange={(e) => loadBatches(e.target.value)}>
              <option value="">Select item</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.item_code} — {i.item_name}</option>)}
            </select>
          </Field>
          <Field label="Batch (approved, available stock)" required>
            <select className={inputClass} required value={form.batch_id} onChange={(e) => setForm({ ...form, batch_id: e.target.value })}>
              <option value="">Select batch</option>
              {availableBatches.map((b) => <option key={b.id} value={b.id}>{b.batch_code} (avail: {b.remaining_qty})</option>)}
            </select>
          </Field>
          <Field label="Quantity" required>
            <input type="number" className={inputClass} required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Issue Material'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
