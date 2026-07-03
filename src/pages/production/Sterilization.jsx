import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useTable } from '../../lib/useTable'
import { supabase } from '../../lib/supabase'
import { generateCode } from '../../lib/codes'
import { PageHeader, Button, Table, EmptyState, Modal, Field, inputClass, Badge, statusTone, Card } from '../../components/ui'
import { Plus, Eye, Trash2 } from 'lucide-react'

export default function Sterilization() {
  const { can, profile } = useAuth()
  const canEdit = can('sterilization', 'edit')

  const { rows, loading, refresh, update } = useTable('sterilization_batches')
  const { rows: productionOrders } = useTable('production_orders', {
    select: '*, material_master(item_code, item_name)',
    filter: (q) => q.eq('status', 'completed'),
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ cycle_no: '', eo_concentration: '', cycle_start: '', notes: '' })
  const [inputs, setInputs] = useState([{ production_order_id: '', quantity: '' }])

  const addInput = () => setInputs([...inputs, { production_order_id: '', quantity: '' }])
  const removeInput = (idx) => setInputs(inputs.filter((_, i) => i !== idx))
  const updateInput = (idx, patch) => setInputs(inputs.map((l, i) => (i === idx ? { ...l, ...patch } : l)))

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const sterilization_batch_code = await generateCode('sterilization_batches')
    const { data: batch, error } = await supabase.from('sterilization_batches').insert({
      sterilization_batch_code, cycle_no: form.cycle_no || null,
      eo_concentration: form.eo_concentration || null,
      cycle_start: form.cycle_start || null, notes: form.notes || null,
      created_by: profile?.id,
    }).select().single()

    if (error) { setSaving(false); alert(error.message); return }

    const inputRows = inputs.filter((i) => i.production_order_id && i.quantity).map((i) => ({
      sterilization_batch_id: batch.id, production_order_id: i.production_order_id, quantity: Number(i.quantity),
    }))
    if (inputRows.length > 0) {
      await supabase.from('sterilization_batch_inputs').insert(inputRows)
    }

    setSaving(false)
    setModalOpen(false)
    setForm({ cycle_no: '', eo_concentration: '', cycle_start: '', notes: '' })
    setInputs([{ production_order_id: '', quantity: '' }])
    refresh()
  }

  const completeCycle = async (row) => {
    await update(row.id, { status: 'completed', cycle_end: new Date().toISOString() })
  }

  const viewDetails = async (batch) => {
    const { data } = await supabase
      .from('sterilization_batch_inputs')
      .select('*, production_orders(production_order_no, batch_code, material_master(item_code, item_name))')
      .eq('sterilization_batch_id', batch.id)
    setViewing({ ...batch, inputs: data || [] })
  }

  return (
    <div>
      <PageHeader
        title="Sterilization"
        description="EO sterilization cycles. Each batch can combine multiple completed production batches into one load."
        action={canEdit && <Button onClick={() => setModalOpen(true)}><Plus size={16} /> New Sterilization Batch</Button>}
      />

      <Table columns={['Batch Code', 'Cycle No', 'EO Conc.', 'Cycle Start', 'Status', '']}>
        {loading ? (
          <EmptyState message="Loading..." />
        ) : rows.length === 0 ? (
          <EmptyState message="No sterilization batches yet." />
        ) : (
          rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-800">{r.sterilization_batch_code}</td>
              <td className="px-4 py-3 text-slate-500">{r.cycle_no || '—'}</td>
              <td className="px-4 py-3 text-slate-500">{r.eo_concentration || '—'}</td>
              <td className="px-4 py-3 text-slate-500">{r.cycle_start ? new Date(r.cycle_start).toLocaleString() : '—'}</td>
              <td className="px-4 py-3"><Badge tone={statusTone(r.status)}>{r.status.replace(/_/g, ' ')}</Badge></td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                  <button onClick={() => viewDetails(r)} className="text-slate-400 hover:text-[#024886]"><Eye size={16} /></button>
                  {canEdit && r.status === 'in_progress' && (
                    <button onClick={() => completeCycle(r)} className="text-xs font-medium text-emerald-600 hover:text-emerald-800">Mark Complete</button>
                  )}
                </div>
              </td>
            </tr>
          ))
        )}
      </Table>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Sterilization Batch" wide>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Cycle No">
              <input className={inputClass} value={form.cycle_no} onChange={(e) => setForm({ ...form, cycle_no: e.target.value })} />
            </Field>
            <Field label="EO Concentration">
              <input className={inputClass} value={form.eo_concentration} onChange={(e) => setForm({ ...form, eo_concentration: e.target.value })} placeholder="e.g. 600 mg/L" />
            </Field>
            <Field label="Cycle Start">
              <input type="datetime-local" className={inputClass} value={form.cycle_start} onChange={(e) => setForm({ ...form, cycle_start: e.target.value })} />
            </Field>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Production Batches in this Load</p>
            <div className="space-y-2">
              {inputs.map((inp, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <select className={`${inputClass} col-span-7`} value={inp.production_order_id} onChange={(e) => updateInput(idx, { production_order_id: e.target.value })}>
                    <option value="">Select production batch</option>
                    {productionOrders.map((p) => <option key={p.id} value={p.id}>{p.batch_code} — {p.material_master?.item_name}</option>)}
                  </select>
                  <input type="number" placeholder="Qty" className={`${inputClass} col-span-4`} value={inp.quantity} onChange={(e) => updateInput(idx, { quantity: e.target.value })} />
                  <button type="button" onClick={() => removeInput(idx)} className="col-span-1 text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addInput} className="text-sm text-[#024886] font-medium mt-2 flex items-center gap-1"><Plus size={14} /> Add batch</button>
          </div>

          <Field label="Notes">
            <textarea className={inputClass} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Start Sterilization'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={`Sterilization ${viewing?.sterilization_batch_code || ''}`} wide>
        {viewing && (
          <Table columns={['Production Batch', 'Product', 'Quantity']}>
            {viewing.inputs.length === 0 ? <EmptyState message="No batches linked." /> : viewing.inputs.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-3">{i.production_orders?.batch_code}</td>
                <td className="px-4 py-3">{i.production_orders?.material_master?.item_name}</td>
                <td className="px-4 py-3">{i.quantity}</td>
              </tr>
            ))}
          </Table>
        )}
      </Modal>
    </div>
  )
}
