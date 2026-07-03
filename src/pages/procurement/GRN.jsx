import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useTable } from '../../lib/useTable'
import { supabase } from '../../lib/supabase'
import { generateCode } from '../../lib/codes'
import { PageHeader, Button, Table, EmptyState, Modal, Field, inputClass, Badge, statusTone, Card } from '../../components/ui'
import { Plus, Trash2, Eye } from 'lucide-react'

export default function GRN() {
  const { can, profile } = useAuth()
  const canEdit = can('grn', 'edit')

  const { rows, loading, refresh } = useTable('grn', { select: '*, suppliers(name), purchase_orders(po_no)' })
  const { rows: suppliers } = useTable('suppliers', { orderBy: 'name', ascending: true })
  const { rows: openPOs } = useTable('purchase_orders', {
    select: '*, suppliers(name)',
    filter: (q) => q.in('status', ['open', 'partial']),
  })
  const { rows: items } = useTable('material_master', { orderBy: 'item_name', ascending: true })

  const [modalOpen, setModalOpen] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ po_id: '', supplier_id: '', invoice_no: '', received_date: new Date().toISOString().slice(0, 10) })
  const [poItems, setPoItems] = useState([])
  const [lines, setLines] = useState([])

  useEffect(() => {
    if (!form.po_id) { setPoItems([]); setLines([]); return }
    supabase.from('purchase_order_items').select('*, material_master(item_code, item_name, unit)').eq('po_id', form.po_id).then(({ data }) => {
      setPoItems(data || [])
      setLines((data || []).map((it) => ({
        po_item_id: it.id, item_id: it.item_id, lot_no: '', batch_no: '', expiry_date: '',
        received_qty: it.ordered_qty - it.received_qty, accepted_qty: '', rejected_qty: '',
      })))
      const po = openPOs.find((p) => p.id === form.po_id)
      if (po) setForm((f) => ({ ...f, supplier_id: po.supplier_id }))
    })
  }, [form.po_id, openPOs])

  const updateLine = (idx, patch) => setLines(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  const addManualLine = () => setLines([...lines, { po_item_id: null, item_id: '', lot_no: '', batch_no: '', expiry_date: '', received_qty: '', accepted_qty: '', rejected_qty: '' }])
  const removeLine = (idx) => setLines(lines.filter((_, i) => i !== idx))

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const grn_no = await generateCode('grn')
    const { data: grn, error } = await supabase
      .from('grn')
      .insert({
        grn_no, po_id: form.po_id || null, supplier_id: form.supplier_id,
        invoice_no: form.invoice_no || null, received_date: form.received_date,
        created_by: profile?.id,
      })
      .select().single()

    if (error) { setSaving(false); alert(error.message); return }

    for (const line of lines) {
      if (!line.item_id || !line.received_qty) continue
      const batch_code = await generateCode('raw_material_batches')
      const { data: batch, error: batchErr } = await supabase.from('raw_material_batches').insert({
        batch_code, item_id: line.item_id, supplier_id: form.supplier_id,
        vendor_lot_no: line.lot_no || null, expiry_date: line.expiry_date || null,
        received_qty: Number(line.received_qty), qc_status: 'pending',
      }).select().single()
      if (batchErr) { console.error(batchErr); continue }

      await supabase.from('grn_items').insert({
        grn_id: grn.id, po_item_id: line.po_item_id, item_id: line.item_id, batch_id: batch.id,
        lot_no: line.lot_no || null, batch_no: line.batch_no || null, expiry_date: line.expiry_date || null,
        received_qty: Number(line.received_qty),
      })

      if (line.po_item_id) {
        const poItem = poItems.find((p) => p.id === line.po_item_id)
        if (poItem) {
          await supabase.from('purchase_order_items').update({
            received_qty: (poItem.received_qty || 0) + Number(line.received_qty),
          }).eq('id', line.po_item_id)
        }
      }
    }

    if (form.po_id) {
      await supabase.from('purchase_orders').update({ status: 'partial' }).eq('id', form.po_id)
    }

    setSaving(false)
    setModalOpen(false)
    setForm({ po_id: '', supplier_id: '', invoice_no: '', received_date: new Date().toISOString().slice(0, 10) })
    setLines([])
    refresh()
  }

  const viewDetails = async (g) => {
    const { data } = await supabase.from('grn_items').select('*, material_master(item_code, item_name, unit)').eq('grn_id', g.id)
    setViewing({ ...g, items: data || [] })
  }

  return (
    <div>
      <PageHeader
        title="Goods Receipt Note (GRN)"
        description="Records incoming material against a PO. Each line creates a traceable raw material batch awaiting QC."
        action={canEdit && <Button onClick={() => setModalOpen(true)}><Plus size={16} /> New GRN</Button>}
      />

      <Table columns={['GRN No', 'Supplier', 'PO Ref', 'Invoice', 'Received Date', 'Status', '']}>
        {loading ? (
          <EmptyState message="Loading..." />
        ) : rows.length === 0 ? (
          <EmptyState message="No GRNs recorded yet." />
        ) : (
          rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-800">{r.grn_no}</td>
              <td className="px-4 py-3">{r.suppliers?.name}</td>
              <td className="px-4 py-3 text-slate-500">{r.purchase_orders?.po_no || 'Manual'}</td>
              <td className="px-4 py-3 text-slate-500">{r.invoice_no || '—'}</td>
              <td className="px-4 py-3 text-slate-500">{r.received_date}</td>
              <td className="px-4 py-3"><Badge tone={statusTone(r.status)}>{r.status.replace(/_/g, ' ')}</Badge></td>
              <td className="px-4 py-3 text-right">
                <button onClick={() => viewDetails(r)} className="text-slate-400 hover:text-[#024886]"><Eye size={16} /></button>
              </td>
            </tr>
          ))
        )}
      </Table>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Goods Receipt Note" wide>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Against Purchase Order">
              <select className={inputClass} value={form.po_id} onChange={(e) => setForm({ ...form, po_id: e.target.value })}>
                <option value="">Manual receipt (no PO)</option>
                {openPOs.map((p) => <option key={p.id} value={p.id}>{p.po_no} — {p.suppliers?.name}</option>)}
              </select>
            </Field>
            <Field label="Supplier" required>
              <select className={inputClass} required value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} disabled={!!form.po_id}>
                <option value="">Select supplier</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Invoice No">
              <input className={inputClass} value={form.invoice_no} onChange={(e) => setForm({ ...form, invoice_no: e.target.value })} />
            </Field>
            <Field label="Received Date" required>
              <input type="date" className={inputClass} required value={form.received_date} onChange={(e) => setForm({ ...form, received_date: e.target.value })} />
            </Field>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Received Items (each line becomes a traceable batch)</p>
            <div className="space-y-2">
              {lines.map((l, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-lg">
                  <select className={`${inputClass} col-span-3`} value={l.item_id} disabled={!!l.po_item_id} onChange={(e) => updateLine(idx, { item_id: e.target.value })}>
                    <option value="">Item</option>
                    {items.map((i) => <option key={i.id} value={i.id}>{i.item_code}</option>)}
                  </select>
                  <input placeholder="Vendor lot no" className={`${inputClass} col-span-2`} value={l.lot_no} onChange={(e) => updateLine(idx, { lot_no: e.target.value })} />
                  <input placeholder="Batch no" className={`${inputClass} col-span-2`} value={l.batch_no} onChange={(e) => updateLine(idx, { batch_no: e.target.value })} />
                  <input type="date" className={`${inputClass} col-span-2`} value={l.expiry_date} onChange={(e) => updateLine(idx, { expiry_date: e.target.value })} />
                  <input type="number" placeholder="Qty" className={`${inputClass} col-span-2`} value={l.received_qty} onChange={(e) => updateLine(idx, { received_qty: e.target.value })} />
                  <button type="button" onClick={() => removeLine(idx)} className="col-span-1 text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addManualLine} className="text-sm text-[#024886] font-medium mt-2 flex items-center gap-1"><Plus size={14} /> Add line</button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Record GRN'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={`GRN ${viewing?.grn_no || ''}`} wide>
        {viewing && (
          <div className="space-y-4">
            <Card className="p-4 grid grid-cols-2 gap-3 text-sm">
              <p><span className="text-slate-500">Supplier:</span> {viewing.suppliers?.name}</p>
              <p><span className="text-slate-500">Invoice:</span> {viewing.invoice_no || '—'}</p>
            </Card>
            <Table columns={['Item', 'Lot No', 'Batch No', 'Expiry', 'Received Qty', 'QC Status']}>
              {viewing.items.length === 0 ? <EmptyState message="No items." /> : viewing.items.map((it) => (
                <tr key={it.id}>
                  <td className="px-4 py-3">{it.material_master?.item_code}</td>
                  <td className="px-4 py-3">{it.lot_no || '—'}</td>
                  <td className="px-4 py-3">{it.batch_no || '—'}</td>
                  <td className="px-4 py-3">{it.expiry_date || '—'}</td>
                  <td className="px-4 py-3">{it.received_qty} {it.material_master?.unit}</td>
                  <td className="px-4 py-3"><Badge tone={statusTone(it.qc_status)}>{it.qc_status}</Badge></td>
                </tr>
              ))}
            </Table>
          </div>
        )}
      </Modal>
    </div>
  )
}
