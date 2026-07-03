import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useTable } from '../../lib/useTable'
import { PageHeader, Button, Table, EmptyState, Modal, Field, inputClass } from '../../components/ui'
import { Plus } from 'lucide-react'

const EMPTY = { item_id: '', rejected_qty: '', reason: '', weight: '', value: '', disposal_method: '' }

export default function ScrapRegister() {
  const { can, profile } = useAuth()
  const canEdit = can('scrap_register', 'edit')

  const { rows, loading, insert } = useTable('scrap_register', {
    select: '*, material_master(item_code, item_name, unit)',
  })
  const { rows: items } = useTable('material_master', { orderBy: 'item_name', ascending: true })

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const { error } = await insert({
      source_table: 'manual', item_id: form.item_id, rejected_qty: Number(form.rejected_qty),
      reason: form.reason || null, weight: form.weight ? Number(form.weight) : null,
      value: form.value ? Number(form.value) : null, disposal_method: form.disposal_method || null,
      recorded_by: profile?.id,
    })
    setSaving(false)
    if (!error) { setModalOpen(false); setForm(EMPTY) } else alert(error.message)
  }

  return (
    <div>
      <PageHeader
        title="Scrap Register"
        description="Auto-logged from QC rejections, plus manual entries for other scrap/waste."
        action={canEdit && <Button onClick={() => setModalOpen(true)}><Plus size={16} /> Log Scrap</Button>}
      />

      <Table columns={['Source', 'Item', 'Rejected Qty', 'Reason', 'Weight', 'Value', 'Disposal', 'Recorded']}>
        {loading ? (
          <EmptyState message="Loading..." />
        ) : rows.length === 0 ? (
          <EmptyState message="No scrap entries yet." />
        ) : (
          rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-500 text-xs">{r.source_table}</td>
              <td className="px-4 py-3">{r.material_master?.item_code || '—'} {r.material_master?.item_name}</td>
              <td className="px-4 py-3">{r.rejected_qty} {r.material_master?.unit}</td>
              <td className="px-4 py-3 text-slate-500">{r.reason || '—'}</td>
              <td className="px-4 py-3 text-slate-500">{r.weight ?? '—'}</td>
              <td className="px-4 py-3 text-slate-500">{r.value ?? '—'}</td>
              <td className="px-4 py-3 text-slate-500">{r.disposal_method || '—'}</td>
              <td className="px-4 py-3 text-slate-400 text-xs">{new Date(r.recorded_at).toLocaleDateString()}</td>
            </tr>
          ))
        )}
      </Table>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log Scrap Entry">
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Item" required>
            <select className={inputClass} required value={form.item_id} onChange={(e) => setForm({ ...form, item_id: e.target.value })}>
              <option value="">Select item</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.item_code} — {i.item_name}</option>)}
            </select>
          </Field>
          <Field label="Rejected Quantity" required>
            <input type="number" className={inputClass} required value={form.rejected_qty} onChange={(e) => setForm({ ...form, rejected_qty: e.target.value })} />
          </Field>
          <Field label="Reason">
            <input className={inputClass} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Weight">
              <input type="number" className={inputClass} value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
            </Field>
            <Field label="Value">
              <input type="number" className={inputClass} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
            </Field>
          </div>
          <Field label="Disposal Method">
            <input className={inputClass} value={form.disposal_method} onChange={(e) => setForm({ ...form, disposal_method: e.target.value })} />
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
