import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useTable } from '../../lib/useTable'
import { PageHeader, Button, Table, EmptyState, Modal, Field, inputClass, Badge } from '../../components/ui'
import { Plus, Pencil, Trash2 } from 'lucide-react'

const EMPTY = {
  item_code: '', item_name: '', category: '', unit: '', default_supplier_id: '',
  lead_time_days: '', moq: '', safety_stock: '', reorder_level: '', max_level: '', avg_daily_consumption: ''
}

export default function MaterialMaster() {
  const { can } = useAuth()
  const canEdit = can('material_master', 'edit')
  const { rows, loading, insert, update, remove } = useTable('material_master', { orderBy: 'item_name', ascending: true })
  const { rows: suppliers } = useTable('suppliers', { orderBy: 'name', ascending: true })

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const openCreate = () => { setEditing(null); setForm(EMPTY); setModalOpen(true) }
  const openEdit = (row) => {
    setEditing(row)
    setForm({
      ...EMPTY,
      ...row,
      default_supplier_id: row.default_supplier_id || '',
    })
    setModalOpen(true)
  }

  const numericFields = ['lead_time_days', 'moq', 'safety_stock', 'reorder_level', 'max_level', 'avg_daily_consumption']

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form }
    numericFields.forEach((f) => { payload[f] = payload[f] === '' ? null : Number(payload[f]) })
    if (!payload.default_supplier_id) payload.default_supplier_id = null

    const { error } = editing ? await update(editing.id, payload) : await insert(payload)
    setSaving(false)
    if (!error) setModalOpen(false)
    else alert(error.message)
  }

  const handleDelete = async (row) => {
    if (!confirm(`Delete ${row.item_name}? This cannot be undone.`)) return
    const { error } = await remove(row.id)
    if (error) alert(error.message)
  }

  return (
    <div>
      <PageHeader
        title="Material Master"
        description="Master list of all raw materials, components, and finished products."
        action={canEdit && (
          <Button onClick={openCreate}><Plus size={16} /> Add Item</Button>
        )}
      />

      <Table columns={['Code', 'Name', 'Category', 'Unit', 'Reorder Level', 'Safety Stock', 'Status', '']}>
        {loading ? (
          <EmptyState message="Loading..." />
        ) : rows.length === 0 ? (
          <EmptyState message="No items yet. Add your first material to get started." />
        ) : (
          rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-800">{r.item_code}</td>
              <td className="px-4 py-3">{r.item_name}</td>
              <td className="px-4 py-3 text-slate-500">{r.category || '—'}</td>
              <td className="px-4 py-3 text-slate-500">{r.unit}</td>
              <td className="px-4 py-3">{r.reorder_level ?? '—'}</td>
              <td className="px-4 py-3">{r.safety_stock ?? '—'}</td>
              <td className="px-4 py-3">
                <Badge tone={r.is_active ? 'green' : 'slate'}>{r.is_active ? 'Active' : 'Inactive'}</Badge>
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap">
                {canEdit && (
                  <div className="flex justify-end gap-2">
                    <button onClick={() => openEdit(r)} className="text-slate-400 hover:text-[#024886]"><Pencil size={16} /></button>
                    <button onClick={() => handleDelete(r)} className="text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
                  </div>
                )}
              </td>
            </tr>
          ))
        )}
      </Table>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Item' : 'Add Item'} wide>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Item Code" required>
              <input className={inputClass} required value={form.item_code} onChange={(e) => setForm({ ...form, item_code: e.target.value })} />
            </Field>
            <Field label="Item Name" required>
              <input className={inputClass} required value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} />
            </Field>
            <Field label="Category">
              <input className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Raw Material" />
            </Field>
            <Field label="Unit" required>
              <input className={inputClass} required value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="e.g. PCS, KG" />
            </Field>
            <Field label="Default Supplier">
              <select className={inputClass} value={form.default_supplier_id} onChange={(e) => setForm({ ...form, default_supplier_id: e.target.value })}>
                <option value="">—</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Lead Time (days)">
              <input type="number" className={inputClass} value={form.lead_time_days} onChange={(e) => setForm({ ...form, lead_time_days: e.target.value })} />
            </Field>
            <Field label="MOQ">
              <input type="number" className={inputClass} value={form.moq} onChange={(e) => setForm({ ...form, moq: e.target.value })} />
            </Field>
            <Field label="Safety Stock">
              <input type="number" className={inputClass} value={form.safety_stock} onChange={(e) => setForm({ ...form, safety_stock: e.target.value })} />
            </Field>
            <Field label="Reorder Level">
              <input type="number" className={inputClass} value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} />
            </Field>
            <Field label="Max Level">
              <input type="number" className={inputClass} value={form.max_level} onChange={(e) => setForm({ ...form, max_level: e.target.value })} />
            </Field>
            <Field label="Avg Daily Consumption">
              <input type="number" className={inputClass} value={form.avg_daily_consumption} onChange={(e) => setForm({ ...form, avg_daily_consumption: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Item'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
