import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useTable } from '../../lib/useTable'
import { PageHeader, Button, Table, EmptyState, Modal, Field, inputClass } from '../../components/ui'
import { Plus } from 'lucide-react'

const EMPTY = { fg_batch_id: '', packed_qty: '', pack_type: '' }

export default function Packing() {
  const { can, profile } = useAuth()
  const canEdit = can('packing', 'edit')

  const { rows, loading, insert } = useTable('packing_records', {
    select: '*, finished_goods_batches(fg_batch_code, material_master(item_code, item_name, unit))',
  })
  const { rows: fgBatches } = useTable('finished_goods_batches', {
    select: '*, material_master(item_code, item_name, unit)',
    filter: (q) => q.eq('qc_status', 'approved'),
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const { error } = await insert({
      fg_batch_id: form.fg_batch_id, packed_qty: Number(form.packed_qty),
      pack_type: form.pack_type || null, packed_by: profile?.id,
    })
    setSaving(false)
    if (!error) { setModalOpen(false); setForm(EMPTY) } else alert(error.message)
  }

  return (
    <div>
      <PageHeader
        title="Packing"
        description="Record packing of QC-approved finished goods batches into shippable units."
        action={canEdit && <Button onClick={() => setModalOpen(true)}><Plus size={16} /> Log Packing</Button>}
      />

      <Table columns={['FG Batch', 'Product', 'Packed Qty', 'Pack Type', 'Packed At']}>
        {loading ? (
          <EmptyState message="Loading..." />
        ) : rows.length === 0 ? (
          <EmptyState message="No packing records yet." />
        ) : (
          rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-800">{r.finished_goods_batches?.fg_batch_code}</td>
              <td className="px-4 py-3">{r.finished_goods_batches?.material_master?.item_name}</td>
              <td className="px-4 py-3">{r.packed_qty} {r.finished_goods_batches?.material_master?.unit}</td>
              <td className="px-4 py-3 text-slate-500">{r.pack_type || '—'}</td>
              <td className="px-4 py-3 text-slate-500">{new Date(r.packed_at).toLocaleDateString()}</td>
            </tr>
          ))
        )}
      </Table>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log Packing">
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Finished Goods Batch" required>
            <select className={inputClass} required value={form.fg_batch_id} onChange={(e) => setForm({ ...form, fg_batch_id: e.target.value })}>
              <option value="">Select batch</option>
              {fgBatches.map((b) => <option key={b.id} value={b.id}>{b.fg_batch_code} — {b.material_master?.item_name}</option>)}
            </select>
          </Field>
          <Field label="Packed Quantity" required>
            <input type="number" className={inputClass} required value={form.packed_qty} onChange={(e) => setForm({ ...form, packed_qty: e.target.value })} />
          </Field>
          <Field label="Pack Type">
            <input className={inputClass} value={form.pack_type} onChange={(e) => setForm({ ...form, pack_type: e.target.value })} placeholder="e.g. Box of 100, Carton of 1000" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
