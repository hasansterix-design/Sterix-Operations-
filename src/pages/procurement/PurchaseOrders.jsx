import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTable } from '../../lib/useTable'
import { supabase } from '../../lib/supabase'
import { generateCode } from '../../lib/codes'
import { PageHeader, Button, Table, EmptyState, Modal, Field, inputClass, Badge, statusTone, Card } from '../../components/ui'
import { Plus, Trash2, Eye } from 'lucide-react'

export default function PurchaseOrders() {
  const { can, profile } = useAuth()
  const canEdit = can('purchase_order', 'edit')
  const location = useLocation()
  const fromPR = location.state?.fromPR

  const { rows, loading, insert, refresh } = useTable('purchase_orders', {
    select: '*, suppliers(name), purchase_requisitions(pr_no)',
  })
  const { rows: suppliers } = useTable('suppliers', { orderBy: 'name', ascending: true })
  const { rows: items } = useTable('material_master', { orderBy: 'item_name', ascending: true })

  const [modalOpen, setModalOpen] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ supplier_id: '', gst_number: '', expected_delivery: '', notes: '', pr_id: '' })
  const [lineItems, setLineItems] = useState([{ item_id: '', ordered_qty: '', unit_price: '' }])

  useEffect(() => {
    if (fromPR) {
      setForm((f) => ({ ...f, pr_id: fromPR.id }))
      setLineItems([{ item_id: fromPR.item_id, ordered_qty: fromPR.required_qty, unit_price: '' }])
      setModalOpen(true)
    }
  }, [fromPR])

  const addLine = () => setLineItems([...lineItems, { item_id: '', ordered_qty: '', unit_price: '' }])
  const removeLine = (idx) => setLineItems(lineItems.filter((_, i) => i !== idx))
  const updateLine = (idx, patch) => setLineItems(lineItems.map((l, i) => (i === idx ? { ...l, ...patch } : l)))

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const po_no = await generateCode('purchase_orders')
    const { data: po, error } = await supabase
      .from('purchase_orders')
      .insert({
        po_no,
        pr_id: form.pr_id || null,
        supplier_id: form.supplier_id,
        gst_number: form.gst_number || null,
        expected_delivery: form.expected_delivery || null,
        notes: form.notes || null,
        created_by: profile?.id,
      })
      .select()
      .single()

    if (error) { setSaving(false); alert(error.message); return }

    const itemRows = lineItems
      .filter((l) => l.item_id && l.ordered_qty)
      .map((l) => ({ po_id: po.id, item_id: l.item_id, ordered_qty: Number(l.ordered_qty), unit_price: l.unit_price ? Number(l.unit_price) : null }))

    if (itemRows.length > 0) {
      const { error: itemErr } = await supabase.from('purchase_order_items').insert(itemRows)
      if (itemErr) { setSaving(false); alert(itemErr.message); return }
    }

    if (form.pr_id) {
      await supabase.from('purchase_requisitions').update({ status: 'converted_to_po' }).eq('id', form.pr_id)
    }

    setSaving(false)
    setModalOpen(false)
    setForm({ supplier_id: '', gst_number: '', expected_delivery: '', notes: '', pr_id: '' })
    setLineItems([{ item_id: '', ordered_qty: '', unit_price: '' }])
    refresh()
  }

  const viewDetails = async (po) => {
    const { data } = await supabase
      .from('purchase_order_items')
      .select('*, material_master(item_code, item_name, unit)')
      .eq('po_id', po.id)
    setViewing({ ...po, items: data || [] })
  }

  return (
    <div>
      <PageHeader
        title="Purchase Order"
        description="Orders raised against suppliers — items here become expected receipts in GRN."
        action={canEdit && <Button onClick={() => setModalOpen(true)}><Plus size={16} /> New Purchase Order</Button>}
      />

      <Table columns={['PO No', 'Supplier', 'From PR', 'Expected Delivery', 'Status', '']}>
        {loading ? (
          <EmptyState message="Loading..." />
        ) : rows.length === 0 ? (
          <EmptyState message="No purchase orders yet." />
        ) : (
          rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-800">{r.po_no}</td>
              <td className="px-4 py-3">{r.suppliers?.name}</td>
              <td className="px-4 py-3 text-slate-500">{r.purchase_requisitions?.pr_no || '—'}</td>
              <td className="px-4 py-3 text-slate-500">{r.expected_delivery || '—'}</td>
              <td className="px-4 py-3"><Badge tone={statusTone(r.status)}>{r.status}</Badge></td>
              <td className="px-4 py-3 text-right">
                <button onClick={() => viewDetails(r)} className="text-slate-400 hover:text-[#024886]"><Eye size={16} /></button>
              </td>
            </tr>
          ))
        )}
      </Table>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Purchase Order" wide>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Supplier" required>
              <select className={inputClass} required value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                <option value="">Select supplier</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="GST Number">
              <input className={inputClass} value={form.gst_number} onChange={(e) => setForm({ ...form, gst_number: e.target.value })} />
            </Field>
            <Field label="Expected Delivery">
              <input type="date" className={inputClass} value={form.expected_delivery} onChange={(e) => setForm({ ...form, expected_delivery: e.target.value })} />
            </Field>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Line Items</p>
            <div className="space-y-2">
              {lineItems.map((l, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <select className={`${inputClass} col-span-5`} value={l.item_id} onChange={(e) => updateLine(idx, { item_id: e.target.value })}>
                    <option value="">Select item</option>
                    {items.map((i) => <option key={i.id} value={i.id}>{i.item_code} — {i.item_name}</option>)}
                  </select>
                  <input type="number" placeholder="Qty" className={`${inputClass} col-span-3`} value={l.ordered_qty} onChange={(e) => updateLine(idx, { ordered_qty: e.target.value })} />
                  <input type="number" placeholder="Unit price" className={`${inputClass} col-span-3`} value={l.unit_price} onChange={(e) => updateLine(idx, { unit_price: e.target.value })} />
                  <button type="button" onClick={() => removeLine(idx)} className="col-span-1 text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addLine} className="text-sm text-[#024886] font-medium mt-2 flex items-center gap-1"><Plus size={14} /> Add line</button>
          </div>

          <Field label="Notes">
            <textarea className={inputClass} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Create Purchase Order'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={`Purchase Order ${viewing?.po_no || ''}`} wide>
        {viewing && (
          <div className="space-y-4">
            <Card className="p-4 grid grid-cols-2 gap-3 text-sm">
              <p><span className="text-slate-500">Supplier:</span> {viewing.suppliers?.name}</p>
              <p><span className="text-slate-500">Status:</span> <Badge tone={statusTone(viewing.status)}>{viewing.status}</Badge></p>
              <p><span className="text-slate-500">Expected Delivery:</span> {viewing.expected_delivery || '—'}</p>
              <p><span className="text-slate-500">Notes:</span> {viewing.notes || '—'}</p>
            </Card>
            <Table columns={['Item', 'Ordered', 'Received', 'Unit Price']}>
              {viewing.items.length === 0 ? <EmptyState message="No line items." /> : viewing.items.map((it) => (
                <tr key={it.id}>
                  <td className="px-4 py-3">{it.material_master?.item_code} — {it.material_master?.item_name}</td>
                  <td className="px-4 py-3">{it.ordered_qty} {it.material_master?.unit}</td>
                  <td className="px-4 py-3">{it.received_qty} {it.material_master?.unit}</td>
                  <td className="px-4 py-3">{it.unit_price ?? '—'}</td>
                </tr>
              ))}
            </Table>
          </div>
        )}
      </Modal>
    </div>
  )
}
