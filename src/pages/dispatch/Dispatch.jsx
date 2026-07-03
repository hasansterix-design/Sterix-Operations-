import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useTable } from '../../lib/useTable'
import { supabase } from '../../lib/supabase'
import { generateCode } from '../../lib/codes'
import { PageHeader, Button, Table, EmptyState, Modal, Field, inputClass, Card } from '../../components/ui'
import { Plus, Trash2, Eye } from 'lucide-react'

export default function Dispatch() {
  const { can, profile } = useAuth()
  const canEdit = can('dispatch', 'edit')

  const { rows, loading, refresh } = useTable('dispatches', { select: '*, customers(name)' })
  const { rows: customers } = useTable('customers', { orderBy: 'name', ascending: true })
  const { rows: fgBatches } = useTable('finished_goods_batches', {
    select: '*, material_master(item_code, item_name, unit)',
    filter: (q) => q.eq('qc_status', 'approved').gt('available_stock', 0),
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ customer_id: '', vehicle_no: '', lr_no: '', dispatch_date: new Date().toISOString().slice(0, 10) })
  const [lines, setLines] = useState([{ fg_batch_id: '', quantity: '' }])

  const addLine = () => setLines([...lines, { fg_batch_id: '', quantity: '' }])
  const removeLine = (idx) => setLines(lines.filter((_, i) => i !== idx))
  const updateLine = (idx, patch) => setLines(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)))

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const invoice_no = await generateCode('dispatches')
    const { data: dispatch, error } = await supabase.from('dispatches').insert({
      invoice_no, customer_id: form.customer_id, vehicle_no: form.vehicle_no || null,
      lr_no: form.lr_no || null, dispatch_date: form.dispatch_date, created_by: profile?.id,
    }).select().single()

    if (error) { setSaving(false); alert(error.message); return }

    for (const line of lines) {
      if (!line.fg_batch_id || !line.quantity) continue
      const qty = Number(line.quantity)
      await supabase.from('dispatch_items').insert({ dispatch_id: dispatch.id, fg_batch_id: line.fg_batch_id, quantity: qty })

      const batch = fgBatches.find((b) => b.id === line.fg_batch_id)
      if (batch) {
        await supabase.from('finished_goods_batches').update({
          available_stock: Math.max(0, batch.available_stock - qty),
          dispatched_stock: (batch.dispatched_stock || 0) + qty,
        }).eq('id', line.fg_batch_id)
      }
    }

    setSaving(false)
    setModalOpen(false)
    setForm({ customer_id: '', vehicle_no: '', lr_no: '', dispatch_date: new Date().toISOString().slice(0, 10) })
    setLines([{ fg_batch_id: '', quantity: '' }])
    refresh()
  }

  const viewDetails = async (d) => {
    const { data } = await supabase
      .from('dispatch_items')
      .select('*, finished_goods_batches(fg_batch_code, material_master(item_code, item_name, unit))')
      .eq('dispatch_id', d.id)
    setViewing({ ...d, items: data || [] })
  }

  return (
    <div>
      <PageHeader
        title="Dispatch Register"
        description="Ship finished goods to customers — can pull from multiple batches in a single invoice."
        action={canEdit && <Button onClick={() => setModalOpen(true)}><Plus size={16} /> New Dispatch</Button>}
      />

      <Table columns={['Invoice', 'Customer', 'Vehicle', 'LR No', 'Dispatch Date', '']}>
        {loading ? (
          <EmptyState message="Loading..." />
        ) : rows.length === 0 ? (
          <EmptyState message="No dispatches recorded yet." />
        ) : (
          rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-800">{r.invoice_no}</td>
              <td className="px-4 py-3">{r.customers?.name}</td>
              <td className="px-4 py-3 text-slate-500">{r.vehicle_no || '—'}</td>
              <td className="px-4 py-3 text-slate-500">{r.lr_no || '—'}</td>
              <td className="px-4 py-3 text-slate-500">{r.dispatch_date}</td>
              <td className="px-4 py-3 text-right">
                <button onClick={() => viewDetails(r)} className="text-slate-400 hover:text-[#024886]"><Eye size={16} /></button>
              </td>
            </tr>
          ))
        )}
      </Table>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Dispatch" wide>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Customer" required>
              <select className={inputClass} required value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
                <option value="">Select customer</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Dispatch Date" required>
              <input type="date" className={inputClass} required value={form.dispatch_date} onChange={(e) => setForm({ ...form, dispatch_date: e.target.value })} />
            </Field>
            <Field label="Vehicle No">
              <input className={inputClass} value={form.vehicle_no} onChange={(e) => setForm({ ...form, vehicle_no: e.target.value })} />
            </Field>
            <Field label="LR No">
              <input className={inputClass} value={form.lr_no} onChange={(e) => setForm({ ...form, lr_no: e.target.value })} />
            </Field>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Batches to Dispatch</p>
            <div className="space-y-2">
              {lines.map((l, idx) => {
                const batch = fgBatches.find((b) => b.id === l.fg_batch_id)
                return (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <select className={`${inputClass} col-span-7`} value={l.fg_batch_id} onChange={(e) => updateLine(idx, { fg_batch_id: e.target.value })}>
                      <option value="">Select batch</option>
                      {fgBatches.map((b) => <option key={b.id} value={b.id}>{b.fg_batch_code} — {b.material_master?.item_name} (avail: {b.available_stock})</option>)}
                    </select>
                    <input type="number" placeholder="Qty" max={batch?.available_stock} className={`${inputClass} col-span-4`} value={l.quantity} onChange={(e) => updateLine(idx, { quantity: e.target.value })} />
                    <button type="button" onClick={() => removeLine(idx)} className="col-span-1 text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
                  </div>
                )
              })}
            </div>
            <button type="button" onClick={addLine} className="text-sm text-[#024886] font-medium mt-2 flex items-center gap-1"><Plus size={14} /> Add batch</button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Create Dispatch'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={`Dispatch ${viewing?.invoice_no || ''}`} wide>
        {viewing && (
          <div className="space-y-4">
            <Card className="p-4 grid grid-cols-2 gap-3 text-sm">
              <p><span className="text-slate-500">Customer:</span> {viewing.customers?.name}</p>
              <p><span className="text-slate-500">Vehicle:</span> {viewing.vehicle_no || '—'}</p>
            </Card>
            <Table columns={['FG Batch', 'Product', 'Quantity']}>
              {viewing.items.length === 0 ? <EmptyState message="No items." /> : viewing.items.map((it) => (
                <tr key={it.id}>
                  <td className="px-4 py-3">{it.finished_goods_batches?.fg_batch_code}</td>
                  <td className="px-4 py-3">{it.finished_goods_batches?.material_master?.item_name}</td>
                  <td className="px-4 py-3">{it.quantity} {it.finished_goods_batches?.material_master?.unit}</td>
                </tr>
              ))}
            </Table>
          </div>
        )}
      </Modal>
    </div>
  )
}
