import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useTable } from '../../lib/useTable'
import { PageHeader, Button, Table, EmptyState, Modal, Field, inputClass, Badge } from '../../components/ui'
import { Plus, Pencil, Trash2 } from 'lucide-react'

const EMPTY = { name: '', gst_number: '', contact_person: '', phone: '', email: '', address: '' }

export default function PartyManager({ table, moduleId, title, description, hasContactPerson = true }) {
  const { can } = useAuth()
  const canEdit = can(moduleId, 'edit')
  const { rows, loading, insert, update, remove } = useTable(table, { orderBy: 'name', ascending: true })

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const openCreate = () => { setEditing(null); setForm(EMPTY); setModalOpen(true) }
  const openEdit = (row) => { setEditing(row); setForm({ ...EMPTY, ...row }); setModalOpen(true) }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const { error } = editing ? await update(editing.id, form) : await insert(form)
    setSaving(false)
    if (!error) setModalOpen(false)
    else alert(error.message)
  }

  const handleDelete = async (row) => {
    if (!confirm(`Delete ${row.name}?`)) return
    const { error } = await remove(row.id)
    if (error) alert(error.message)
  }

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        action={canEdit && <Button onClick={openCreate}><Plus size={16} /> Add</Button>}
      />

      <Table columns={['Name', 'GST No.', hasContactPerson ? 'Contact Person' : 'Phone', 'Phone', 'Status', '']}>
        {loading ? (
          <EmptyState message="Loading..." />
        ) : rows.length === 0 ? (
          <EmptyState message="No records yet." />
        ) : (
          rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-800">{r.name}</td>
              <td className="px-4 py-3 text-slate-500">{r.gst_number || '—'}</td>
              <td className="px-4 py-3 text-slate-500">{hasContactPerson ? (r.contact_person || '—') : (r.phone || '—')}</td>
              <td className="px-4 py-3 text-slate-500">{r.phone || '—'}</td>
              <td className="px-4 py-3"><Badge tone={r.is_active ? 'green' : 'slate'}>{r.is_active ? 'Active' : 'Inactive'}</Badge></td>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit' : 'Add New'}>
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Name" required>
            <input className={inputClass} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="GST Number">
            <input className={inputClass} value={form.gst_number} onChange={(e) => setForm({ ...form, gst_number: e.target.value })} />
          </Field>
          {hasContactPerson && (
            <Field label="Contact Person">
              <input className={inputClass} value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
            </Field>
          )}
          <Field label="Phone">
            <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <input type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Address">
            <textarea className={inputClass} rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
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
