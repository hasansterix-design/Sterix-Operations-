import { useState } from 'react'
import { useTable } from '../../lib/useTable'
import { supabase } from '../../lib/supabase'
import { PageHeader, Card, Table, EmptyState, Badge, inputClass } from '../../components/ui'
import { Search, ArrowDown, ArrowRight } from 'lucide-react'

export default function BatchTraceability() {
  const { rows: fgBatches } = useTable('finished_goods_batches', {
    select: '*, material_master(item_code, item_name)',
  })
  const { rows: rawBatches } = useTable('raw_material_batches', {
    select: '*, material_master(item_code, item_name)',
  })

  const [mode, setMode] = useState('forward') // forward: FG -> backward to raw; backward: raw -> forward to dispatch
  const [selectedId, setSelectedId] = useState('')
  const [trace, setTrace] = useState(null)
  const [loading, setLoading] = useState(false)

  const traceFromFG = async (fgId) => {
    setLoading(true)
    const fg = fgBatches.find((b) => b.id === fgId)

    const { data: dispatchItems } = await supabase
      .from('dispatch_items').select('*, dispatches(invoice_no, dispatch_date, customers(name))')
      .eq('fg_batch_id', fgId)

    const { data: sterBatch } = fg.sterilization_batch_id
      ? await supabase.from('sterilization_batches').select('*').eq('id', fg.sterilization_batch_id).single()
      : { data: null }

    const { data: sterInputs } = fg.sterilization_batch_id
      ? await supabase.from('sterilization_batch_inputs').select('*, production_orders(production_order_no, batch_code)').eq('sterilization_batch_id', fg.sterilization_batch_id)
      : { data: [] }

    const productionOrderIds = (sterInputs || []).map((s) => s.production_order_id)
    let rawConsumption = []
    if (productionOrderIds.length > 0) {
      const { data } = await supabase
        .from('production_batch_consumption')
        .select('*, raw_material_batches(batch_code, vendor_lot_no, item_id, material_master(item_code, item_name)), production_orders(production_order_no, batch_code)')
        .in('production_order_id', productionOrderIds)
      rawConsumption = data || []
    }

    setTrace({
      fg, dispatchItems: dispatchItems || [], sterBatch, sterInputs: sterInputs || [], rawConsumption,
    })
    setLoading(false)
  }

  const traceFromRaw = async (rawId) => {
    setLoading(true)
    const raw = rawBatches.find((b) => b.id === rawId)

    const { data: consumption } = await supabase
      .from('production_batch_consumption')
      .select('*, production_orders(id, production_order_no, batch_code, material_master(item_name))')
      .eq('raw_material_batch_id', rawId)

    const productionOrderIds = (consumption || []).map((c) => c.production_orders?.id).filter(Boolean)
    let sterInputs = []
    let fgBatchesFound = []
    let dispatchesFound = []

    if (productionOrderIds.length > 0) {
      const { data: si } = await supabase
        .from('sterilization_batch_inputs')
        .select('*, sterilization_batches(id, sterilization_batch_code)')
        .in('production_order_id', productionOrderIds)
      sterInputs = si || []

      const sterIds = sterInputs.map((s) => s.sterilization_batches?.id).filter(Boolean)
      if (sterIds.length > 0) {
        const { data: fgs } = await supabase
          .from('finished_goods_batches')
          .select('*, material_master(item_code, item_name)')
          .in('sterilization_batch_id', sterIds)
        fgBatchesFound = fgs || []

        const fgIds = fgBatchesFound.map((f) => f.id)
        if (fgIds.length > 0) {
          const { data: dis } = await supabase
            .from('dispatch_items')
            .select('*, dispatches(invoice_no, dispatch_date, customers(name)), finished_goods_batches(fg_batch_code)')
            .in('fg_batch_id', fgIds)
          dispatchesFound = dis || []
        }
      }
    }

    setTrace({ raw, consumption: consumption || [], sterInputs, fgBatchesFound, dispatchesFound })
    setLoading(false)
  }

  const handleTrace = () => {
    if (!selectedId) return
    if (mode === 'forward') traceFromFG(selectedId)
    else traceFromRaw(selectedId)
  }

  return (
    <div>
      <PageHeader
        title="Batch Traceability"
        description="Trace a Finished Goods batch back to its raw materials, or trace a raw material lot forward to every dispatch it touched — essential for audits and recalls."
      />

      <Card className="p-5 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1">Trace direction</p>
            <div className="flex rounded-lg border border-slate-300 overflow-hidden">
              <button
                onClick={() => { setMode('forward'); setSelectedId('') }}
                className={`px-3 py-2 text-sm ${mode === 'forward' ? 'bg-[#024886] text-white' : 'bg-white text-slate-600'}`}
              >
                FG → Raw Material
              </button>
              <button
                onClick={() => { setMode('backward'); setSelectedId('') }}
                className={`px-3 py-2 text-sm ${mode === 'backward' ? 'bg-[#024886] text-white' : 'bg-white text-slate-600'}`}
              >
                Raw Material → Dispatch
              </button>
            </div>
          </div>
          <div className="flex-1 min-w-[260px]">
            <p className="text-sm font-medium text-slate-700 mb-1">{mode === 'forward' ? 'Finished Goods Batch' : 'Raw Material Batch'}</p>
            <select className={inputClass} value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              <option value="">Select a batch</option>
              {mode === 'forward'
                ? fgBatches.map((b) => <option key={b.id} value={b.id}>{b.fg_batch_code} — {b.material_master?.item_name}</option>)
                : rawBatches.map((b) => <option key={b.id} value={b.id}>{b.batch_code} — {b.material_master?.item_name}</option>)}
            </select>
          </div>
          <button onClick={handleTrace} className="bg-[#024886] text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-1.5 hover:bg-[#01345f]">
            <Search size={15} /> Trace
          </button>
        </div>
      </Card>

      {loading && <p className="text-slate-400 text-sm">Tracing...</p>}

      {trace && mode === 'forward' && trace.fg && (
        <div className="space-y-4">
          <TraceNode title="Finished Goods Batch" code={trace.fg.fg_batch_code} subtitle={trace.fg.material_master?.item_name} />
          <Arrow />
          <TraceNode title="Sterilization Batch" code={trace.sterBatch?.sterilization_batch_code || 'Not yet sterilized'} subtitle={trace.sterBatch?.cycle_no ? `Cycle ${trace.sterBatch.cycle_no}` : ''} />
          <Arrow />
          <Card className="p-4">
            <p className="text-sm font-medium text-slate-700 mb-2">Production Batches in this Sterilization Load</p>
            {trace.sterInputs.length === 0 ? <p className="text-sm text-slate-400">None linked.</p> : (
              <ul className="text-sm space-y-1">
                {trace.sterInputs.map((s) => <li key={s.id}>• {s.production_orders?.batch_code} (qty {s.quantity})</li>)}
              </ul>
            )}
          </Card>
          <Arrow />
          <Card className="p-4">
            <p className="text-sm font-medium text-slate-700 mb-2">Raw Material Batches Consumed</p>
            {trace.rawConsumption.length === 0 ? <p className="text-sm text-slate-400">None linked.</p> : (
              <Table columns={['Raw Batch', 'Item', 'Vendor Lot', 'Qty Consumed', 'In Production Batch']}>
                {trace.rawConsumption.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-medium">{c.raw_material_batches?.batch_code}</td>
                    <td className="px-4 py-3">{c.raw_material_batches?.material_master?.item_name}</td>
                    <td className="px-4 py-3 text-slate-500">{c.raw_material_batches?.vendor_lot_no || '—'}</td>
                    <td className="px-4 py-3">{c.quantity_consumed}</td>
                    <td className="px-4 py-3 text-slate-500">{c.production_orders?.batch_code}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
          <Arrow direction="up" />
          <Card className="p-4">
            <p className="text-sm font-medium text-slate-700 mb-2">Dispatched To</p>
            {trace.dispatchItems.length === 0 ? <p className="text-sm text-slate-400">Not yet dispatched.</p> : (
              <Table columns={['Invoice', 'Customer', 'Qty', 'Date']}>
                {trace.dispatchItems.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-3 font-medium">{d.dispatches?.invoice_no}</td>
                    <td className="px-4 py-3">{d.dispatches?.customers?.name}</td>
                    <td className="px-4 py-3">{d.quantity}</td>
                    <td className="px-4 py-3 text-slate-500">{d.dispatches?.dispatch_date}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </div>
      )}

      {trace && mode === 'backward' && trace.raw && (
        <div className="space-y-4">
          <TraceNode title="Raw Material Batch" code={trace.raw.batch_code} subtitle={`${trace.raw.material_master?.item_name} · Vendor lot: ${trace.raw.vendor_lot_no || '—'}`} />
          <Arrow />
          <Card className="p-4">
            <p className="text-sm font-medium text-slate-700 mb-2">Used in Production Batches</p>
            {trace.consumption.length === 0 ? <p className="text-sm text-slate-400">Not yet consumed.</p> : (
              <ul className="text-sm space-y-1">
                {trace.consumption.map((c) => <li key={c.id}>• {c.production_orders?.batch_code} — {c.production_orders?.material_master?.item_name} (qty {c.quantity_consumed})</li>)}
              </ul>
            )}
          </Card>
          <Arrow />
          <Card className="p-4">
            <p className="text-sm font-medium text-slate-700 mb-2">Finished Goods Batches Affected</p>
            {trace.fgBatchesFound.length === 0 ? <p className="text-sm text-slate-400">None yet.</p> : (
              <ul className="text-sm space-y-1">
                {trace.fgBatchesFound.map((f) => <li key={f.id}>• {f.fg_batch_code} — {f.material_master?.item_name}</li>)}
              </ul>
            )}
          </Card>
          <Arrow />
          <Card className="p-4 border-2 border-amber-200 bg-amber-50">
            <p className="text-sm font-semibold text-amber-800 mb-2">Customer Dispatches Potentially Affected</p>
            {trace.dispatchesFound.length === 0 ? <p className="text-sm text-slate-500">None dispatched yet — this lot can still be contained.</p> : (
              <Table columns={['Invoice', 'Customer', 'FG Batch', 'Qty', 'Date']}>
                {trace.dispatchesFound.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-3 font-medium">{d.dispatches?.invoice_no}</td>
                    <td className="px-4 py-3">{d.dispatches?.customers?.name}</td>
                    <td className="px-4 py-3 text-slate-500">{d.finished_goods_batches?.fg_batch_code}</td>
                    <td className="px-4 py-3">{d.quantity}</td>
                    <td className="px-4 py-3 text-slate-500">{d.dispatches?.dispatch_date}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </div>
      )}

      {!trace && !loading && (
        <p className="text-sm text-slate-400 text-center py-12">Select a batch above and click Trace to see its full chain.</p>
      )}
    </div>
  )
}

function TraceNode({ title, code, subtitle }) {
  return (
    <Card className="p-4 border-2 border-[#024886]/20">
      <p className="text-xs text-slate-400 uppercase tracking-wide">{title}</p>
      <p className="text-lg font-semibold text-[#024886]">{code}</p>
      {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
    </Card>
  )
}

function Arrow({ direction = 'down' }) {
  return (
    <div className="flex justify-center text-slate-300">
      {direction === 'down' ? <ArrowDown size={18} /> : <ArrowRight size={18} className="rotate-90" />}
    </div>
  )
}
