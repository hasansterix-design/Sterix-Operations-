import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useTable } from '../../lib/useTable'
import { supabase } from '../../lib/supabase'
import { generateCode } from '../../lib/codes'
import { PageHeader, Table, EmptyState, Badge, statusTone, Button, Modal, Field, inputClass } from '../../components/ui'
import { Check, X as XIcon } from 'lucide-react'

export default function FinalQC() {
  const { can, profile } = useAuth()
  const canEdit = can('final_qc', 'edit')

  const { rows, loading, refresh } = useTable('sterilization_batches', {
    filter: (q) => q.eq('status', 'completed'),
  })

  const [reviewing, setReviewing] = useState(null)
  const [decision, setDecision] = useState(null)
  const [productId, setProductId] = useState('')
  const [approvedQty, setApprovedQty] = useState('')
  const [rejectedQty, setRejectedQty] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [deviation, setDeviation] = useState('')
  const [saving, setSaving] = useState(false)

  const { rows: products } = useTable('material_master', { orderBy: 'item_name', ascending: true })

  const openReview = (row, dec) => {
    setReviewing(row); setDecision(dec); setProductId(''); setApprovedQty(''); setRejectedQty(''); setExpiryDate(''); setDeviation('')
  }

  const submitDecision = async (e) => {
    e.preventDefault()
    setSaving(true)
    const approved = Number(approvedQty) || 0
    const rejected = Number(rejectedQty) || 0

    if (decision === 'approved') {
      const fg_batch_code = await generateCode('finished_goods_batches')
      await supabase.from('finished_goods_batches').insert({
        fg_batch_code, product_id: productId, sterilization_batch_id: reviewing.id,
        manufacturing_date: new Date().toISOString().slice(0, 10),
        expiry_date: expiryDate || null, qc_status: 'approved',
        available_stock: approved,
      })
      await supabase.from('quality_inspections').insert({
        inspection_type: 'final', reference_table: 'sterilization_batches', reference_id: reviewing.id,
        acceptance_status: 'accepted', deviation_notes: deviation || null, inspected_by: profile?.id,
      })
    } else {
      await supabase.from('scrap_register').insert({
        source_table: 'sterilization_batches', source_id: reviewing.id, item_id: productId || null,
        rejected_qty: rejected, reason: deviation || 'Final QC rejection', recorded_by: profile?.id,
      })
      await supabase.from('quality_inspections').insert({
        inspection_type: 'final', reference_table: 'sterilization_batches', reference_id: reviewing.id,
        acceptance_status: 'rejected', deviation_notes: deviation || null, inspected_by: profile?.id,
      })
    }

    setSaving(false)
    setReviewing(null)
    refresh()
  }

  return (
    <div>
      <PageHeader
        title="Final QC"
        description="Reviews completed sterilization batches. Approved batches become Finished Goods; rejected go to Scrap."
      />

      <Table columns={['Sterilization Batch', 'Cycle End', '']}>
        {loading ? (
          <EmptyState message="Loading..." />
        ) : rows.length === 0 ? (
          <EmptyState message="No batches awaiting final QC." />
        ) : (
          rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-800">{r.sterilization_batch_code}</td>
              <td className="px-4 py-3 text-slate-500">{r.cycle_end ? new Date(r.cycle_end).toLocaleString() : '—'}</td>
              <td className="px-4 py-3 text-right">
                {canEdit && (
                  <div className="flex justify-end gap-2">
                    <button onClick={() => openReview(r, 'approved')} className="text-emerald-600 hover:text-emerald-800"><Check size={16} /></button>
                    <button onClick={() => openReview(r, 'rejected')} className="text-red-500 hover:text-red-700"><XIcon size={16} /></button>
                  </div>
                )}
              </td>
            </tr>
          ))
        )}
      </Table>

      <Modal open={!!reviewing} onClose={() => setReviewing(null)} title={`Final QC — ${reviewing?.sterilization_batch_code || ''}`}>
        {reviewing && (
          <form onSubmit={submitDecision} className="space-y-4">
            <Field label="Product" required>
              <select className={inputClass} required value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Select product</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.item_code} — {p.item_name}</option>)}
              </select>
            </Field>
            {decision === 'approved' ? (
              <>
                <Field label="Approved Quantity" required>
                  <input type="number" className={inputClass} required value={approvedQty} onChange={(e) => setApprovedQty(e.target.value)} />
                </Field>
                <Field label="Expiry Date">
                  <input type="date" className={inputClass} value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
                </Field>
              </>
            ) : (
              <Field label="Rejected Quantity" required>
                <input type="number" className={inputClass} required value={rejectedQty} onChange={(e) => setRejectedQty(e.target.value)} />
              </Field>
            )}
            <Field label="Deviation Notes">
              <textarea className={inputClass} rows={2} value={deviation} onChange={(e) => setDeviation(e.target.value)} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" type="button" onClick={() => setReviewing(null)}>Cancel</Button>
              <Button type="submit" disabled={saving} variant={decision === 'rejected' ? 'danger' : 'primary'}>
                {saving ? 'Saving...' : decision === 'approved' ? 'Approve to Finished Goods' : 'Reject to Scrap'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
