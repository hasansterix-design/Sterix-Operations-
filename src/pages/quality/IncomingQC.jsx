import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useTable } from '../../lib/useTable'
import { supabase } from '../../lib/supabase'
import { PageHeader, Table, EmptyState, Badge, statusTone, Button, Modal, Field, inputClass } from '../../components/ui'
import { Check, X as XIcon } from 'lucide-react'

export default function IncomingQC() {
  const { can, profile } = useAuth()
  const canEdit = can('incoming_qc', 'edit')

  const { rows, loading, refresh } = useTable('raw_material_batches', {
    select: '*, material_master(item_code, item_name, unit), suppliers(name)',
  })

  const [reviewing, setReviewing] = useState(null)
  const [decision, setDecision] = useState(null) // 'approved' | 'rejected'
  const [acceptedQty, setAcceptedQty] = useState('')
  const [rejectedQty, setRejectedQty] = useState('')
  const [deviation, setDeviation] = useState('')
  const [capa, setCapa] = useState('')
  const [saving, setSaving] = useState(false)

  const openReview = (row, dec) => {
    setReviewing(row)
    setDecision(dec)
    setAcceptedQty(dec === 'approved' ? String(row.received_qty) : '0')
    setRejectedQty(dec === 'rejected' ? String(row.received_qty) : '0')
    setDeviation('')
    setCapa('')
  }

  const submitDecision = async (e) => {
    e.preventDefault()
    setSaving(true)
    const accepted = Number(acceptedQty) || 0
    const rejected = Number(rejectedQty) || 0

    await supabase.from('raw_material_batches').update({
      qc_status: decision,
      accepted_qty: accepted,
      rejected_qty: rejected,
      remaining_qty: accepted,
    }).eq('id', reviewing.id)

    await supabase.from('quality_inspections').insert({
      inspection_type: 'incoming',
      reference_table: 'raw_material_batches',
      reference_id: reviewing.id,
      acceptance_status: decision === 'approved' ? 'accepted' : 'rejected',
      deviation_notes: deviation || null,
      capa_notes: capa || null,
      inspected_by: profile?.id,
    })

    if (accepted > 0) {
      const { data: lastEntry } = await supabase
        .from('stock_ledger').select('running_balance').eq('item_id', reviewing.item_id)
        .order('txn_date', { ascending: false }).limit(1).maybeSingle()
      const prevBalance = lastEntry?.running_balance || 0

      await supabase.from('stock_ledger').insert({
        item_id: reviewing.item_id, txn_type: 'receipt', quantity: accepted,
        reference_table: 'raw_material_batches', reference_id: reviewing.id,
        batch_id: reviewing.id, running_balance: prevBalance + accepted,
        created_by: profile?.id,
      })
    }

    if (rejected > 0) {
      await supabase.from('scrap_register').insert({
        source_table: 'raw_material_batches', source_id: reviewing.id, item_id: reviewing.item_id,
        rejected_qty: rejected, reason: deviation || 'Incoming QC rejection', recorded_by: profile?.id,
      })
    }

    setSaving(false)
    setReviewing(null)
    refresh()
  }

  return (
    <div>
      <PageHeader
        title="Incoming Quality Inspection"
        description="Review raw material batches received via GRN. Approving posts accepted quantity to the stock ledger."
      />

      <Table columns={['Batch Code', 'Item', 'Supplier', 'Lot No.', 'Received Qty', 'Status', '']}>
        {loading ? (
          <EmptyState message="Loading..." />
        ) : rows.length === 0 ? (
          <EmptyState message="No incoming batches yet." />
        ) : (
          rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-800">{r.batch_code}</td>
              <td className="px-4 py-3">{r.material_master?.item_code} — {r.material_master?.item_name}</td>
              <td className="px-4 py-3 text-slate-500">{r.suppliers?.name}</td>
              <td className="px-4 py-3 text-slate-500">{r.vendor_lot_no || '—'}</td>
              <td className="px-4 py-3">{r.received_qty} {r.material_master?.unit}</td>
              <td className="px-4 py-3"><Badge tone={statusTone(r.qc_status)}>{r.qc_status}</Badge></td>
              <td className="px-4 py-3 text-right">
                {canEdit && r.qc_status === 'pending' && (
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

      <Modal open={!!reviewing} onClose={() => setReviewing(null)} title={`${decision === 'approved' ? 'Approve' : 'Reject'} Batch ${reviewing?.batch_code || ''}`}>
        {reviewing && (
          <form onSubmit={submitDecision} className="space-y-4">
            <p className="text-sm text-slate-500">Received quantity: {reviewing.received_qty} {reviewing.material_master?.unit}</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Accepted Qty">
                <input type="number" className={inputClass} value={acceptedQty} onChange={(e) => setAcceptedQty(e.target.value)} />
              </Field>
              <Field label="Rejected Qty">
                <input type="number" className={inputClass} value={rejectedQty} onChange={(e) => setRejectedQty(e.target.value)} />
              </Field>
            </div>
            <Field label="Deviation Notes">
              <textarea className={inputClass} rows={2} value={deviation} onChange={(e) => setDeviation(e.target.value)} />
            </Field>
            {decision === 'rejected' && (
              <Field label="CAPA (Corrective / Preventive Action)">
                <textarea className={inputClass} rows={2} value={capa} onChange={(e) => setCapa(e.target.value)} />
              </Field>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" type="button" onClick={() => setReviewing(null)}>Cancel</Button>
              <Button type="submit" disabled={saving} variant={decision === 'rejected' ? 'danger' : 'primary'}>
                {saving ? 'Saving...' : `Confirm ${decision === 'approved' ? 'Approval' : 'Rejection'}`}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
