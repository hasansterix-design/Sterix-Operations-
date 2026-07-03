// Generates sequential human-readable codes like RM-2026-0001, PO-2026-0042, etc.
// Uses a simple "count existing rows this year + 1" approach per prefix/table.
import { supabase } from './supabase'

const PAD = 4

export async function nextCode(table, column, prefix) {
  const year = new Date().getFullYear()
  const likePattern = `${prefix}-${year}-%`
  const { count, error } = await supabase
    .from(table)
    .select(column, { count: 'exact', head: true })
    .like(column, likePattern)

  if (error) throw error
  const next = (count || 0) + 1
  return `${prefix}-${year}-${String(next).padStart(PAD, '0')}`
}

export const CODE_PREFIXES = {
  purchase_requisitions: { table: 'purchase_requisitions', column: 'pr_no', prefix: 'PR' },
  purchase_orders: { table: 'purchase_orders', column: 'po_no', prefix: 'PO' },
  grn: { table: 'grn', column: 'grn_no', prefix: 'GRN' },
  raw_material_batches: { table: 'raw_material_batches', column: 'batch_code', prefix: 'RM' },
  production_orders_order: { table: 'production_orders', column: 'production_order_no', prefix: 'WO' },
  production_orders_batch: { table: 'production_orders', column: 'batch_code', prefix: 'PB' },
  sterilization_batches: { table: 'sterilization_batches', column: 'sterilization_batch_code', prefix: 'STR' },
  finished_goods_batches: { table: 'finished_goods_batches', column: 'fg_batch_code', prefix: 'FG' },
  material_issues: { table: 'material_issues', column: 'issue_no', prefix: 'MI' },
  dispatches: { table: 'dispatches', column: 'invoice_no', prefix: 'INV' },
}

export async function generateCode(key) {
  const cfg = CODE_PREFIXES[key]
  if (!cfg) throw new Error(`Unknown code key: ${key}`)
  return nextCode(cfg.table, cfg.column, cfg.prefix)
}
