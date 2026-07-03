import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useTable } from '../../lib/useTable'
import { PageHeader, Button, Table, EmptyState, Modal, Field, inputClass, Badge, statusTone } from '../../components/ui'
import { Plus } from 'lucide-react'

const EMPTY = { production_order_id: '', operation: '', input_qty: '', output_qty: '', loss_qty: '0', status: 'in_progress' }

export default function WipInventory() {
  const { can, profile } = useAuth()
  const canEdit = can('wip', 'edit')

  const { rows, loading, insert } = useTable('wip_batches', {
    select: '*, production_orders(production_order_no, batch_code)',
  })
  const { rows: productionOrders } = useTable('production_orders', {
    filter: (q) => q.in('status', ['planned', 'in_progress']),
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const { error } = await insert({
      production_order_id: form.production_order_id, operation: form.operation,
      input_qty: Number(form.input_qty), output_qty: Number(form.output_qty),
      loss_qty: Number(form.loss_qty) || 0, status: form.status, recorded_by: profile?.id,
    })
    setSaving(false)
    if (!error) { setModalOpen(false); setForm(EMPTY) } else alert(error.message)
  }

  return (
    <div>
      <PageHeader
        title="WIP Inventory"
        description="Tracks each production operation's input, output, and loss within a production order."
        action={canEdit && <Button onClick={() => setModalOpen(true)}><Plus size={16} /> Log Operation</Button>}
      />

      <Table columns={['Production Order', 'Batch', 'Operation', 'Input', 'Output', 'Loss', 'Status']}>
        {loading ? (
          <EmptyState message="Loading..." />
        ) : rows.length === 0 ? (
          <EmptyState message="No WIP entries yet." />
        ) : (
          rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-800">{r.production_orders?.production_order_no}</td>
              <td className="px-4 py-3 text-slate-500">{r.production_orders?.batch_code}</td>
              <td className="px-4 py-3">{r.operation}</td>
              <td className="px-4 py-3">{r.input_qty}</td>
              <td className="px-4 py-3">{r.output_qty}</td>
              <td className="px-4 py-3 text-red-600">{r.loss_qty}</td>
              <td className="px-4 py-3"><Badge tone={statusTone(r.status)}>{r.status.replace(/_/g, ' ')}</Badge></td>
            </tr>
          ))
        )}
      </Table>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log Production Operation">
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Production Order" required>
            <select className={inputClass} required value={form.production_order_id} onChange={(e) => setForm({ ...form, production_order_id: e.target.value })}>
              <option value="">Select order</option>
              {productionOrders.map((p) => <option key={p.id} value={p.id}>{p.production_order_no} ({p.batch_code})</option>)}
            </select>
          </Field>
          <Field label="Operation" required>
            <input className={inputClass} required value={form.operation} onChange={(e) => setForm({ ...form, operation: e.target.value })} placeholder="e.g. Molding, Assembly, Printing" />
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Input Qty" required>
              <input type="number" className={inputClass} required value={form.input_qty} onChange={(e) => setForm({ ...form, input_qty: e.target.value })} />
            </Field>
            <Field label="Output Qty" required>
              <input type="number" className={inputClass} required value={form.output_qty} onChange={(e) => setForm({ ...form, output_qty: e.target.value })} />
            </Field>
            <Field label="Loss Qty">
              <input type="number" className={inputClass} value={form.loss_qty} onChange={(e) => setForm({ ...form, loss_qty: e.target.value })} />
            </Field>
          </div>
          <Field label="Status">
            <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="on_hold">On Hold</option>
            </select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Entry'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
