import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useTable } from '../../lib/useTable'
import { generateCode } from '../../lib/codes'
import { PageHeader, Button, Table, EmptyState, Modal, Field, inputClass, Badge, statusTone } from '../../components/ui'
import { Plus, Check, X as XIcon, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const EMPTY = { department: '', item_id: '', required_qty: '', required_date: '', notes: '' }

export default function PurchaseRequisitions() {
  const { can, profile } = useAuth()
  const canEdit = can('purchase_requisition', 'edit')
  const canPO = can('purchase_order', 'edit')
  const navigate = useNavigate()
  const { rows, loading, insert, update } = useTable('purchase_requisitions', {
    select: '*, material_master(item_code, item_name, unit)',
  })
  const { rows: items } = useTable('material_master', { orderBy: 'item_name', ascending: true })

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const pr_no = await generateCode('purchase_requisitions')
    const { error } = await insert({
      pr_no,
      department: form.department,
      item_id: form.item_id,
      required_qty: Number(form.required_qty),
      required_date: form.required_date || null,
      notes: form.notes || null,
      created_by: profile?.id,
    })
    setSaving(false)
    if (!error) { setModalOpen(false); setForm(EMPTY) } else alert(error.message)
  }

  const setStatus = async (row, status) => {
    await update(row.id, { status, approved_by: profile?.id, approved_at: new Date().toISOString() })
  }

  return (
    <div>
      <PageHeader
        title="Purchase Requisition"
        description="Departments request materials here; approved requisitions can be converted into a Purchase Order."
        action={canEdit && <Button onClick={() => setModalOpen(true)}><Plus size={16} /> New Requisition</Button>}
      />

      <Table columns={['PR No', 'Department', 'Item', 'Qty', 'Required Date', 'Status', '']}>
        {loading ? (
          <EmptyState message="Loading..." />
        ) : rows.length === 0 ? (
          <EmptyState message="No requisitions yet." />
        ) : (
          rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-800">{r.pr_no}</td>
              <td className="px-4 py-3">{r.department}</td>
              <td className="px-4 py-3">{r.material_master?.item_code} — {r.material_master?.item_name}</td>
              <td className="px-4 py-3">{r.required_qty} {r.material_master?.unit}</td>
              <td className="px-4 py-3 text-slate-500">{r.required_date || '—'}</td>
              <td className="px-4 py-3"><Badge tone={statusTone(r.status)}>{r.status.replace(/_/g, ' ')}</Badge></td>
              <td className="px-4 py-3 text-right whitespace-nowrap">
                <div className="flex justify-end gap-2">
                  {canEdit && r.status === 'pending' && (
                    <>
                      <button title="Approve" onClick={() => setStatus(r, 'approved')} className="text-emerald-600 hover:text-emerald-800"><Check size={16} /></button>
                      <button title="Reject" onClick={() => setStatus(r, 'rejected')} className="text-red-500 hover:text-red-700"><XIcon size={16} /></button>
                    </>
                  )}
                  {canPO && r.status === 'approved' && (
                    <button
                      title="Convert to Purchase Order"
                      onClick={() => navigate('/procurement/purchase-orders', { state: { fromPR: r } })}
                      className="text-[#024886] hover:text-[#01345f] flex items-center gap-1 text-xs font-medium"
                    >
                      To PO <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))
        )}
      </Table>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Purchase Requisition">
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Department" required>
            <input className={inputClass} required value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="e.g. Production, Store" />
          </Field>
          <Field label="Material" required>
            <select className={inputClass} required value={form.item_id} onChange={(e) => setForm({ ...form, item_id: e.target.value })}>
              <option value="">Select item</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.item_code} — {i.item_name}</option>)}
            </select>
          </Field>
          <Field label="Required Quantity" required>
            <input type="number" className={inputClass} required value={form.required_qty} onChange={(e) => setForm({ ...form, required_qty: e.target.value })} />
          </Field>
          <Field label="Required Date">
            <input type="date" className={inputClass} value={form.required_date} onChange={(e) => setForm({ ...form, required_date: e.target.value })} />
          </Field>
          <Field label="Notes">
            <textarea className={inputClass} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Submit Requisition'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
