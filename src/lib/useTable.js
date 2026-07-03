import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

// select: e.g. '*, suppliers(name)' for joins
// filter: optional (query) => query function for .eq/.in/.gt etc chains.
// IMPORTANT: filter functions are read via a ref so passing a fresh inline
// arrow function on every render (the common case in this app) does NOT
// trigger a refetch loop. Only `table`, `select`, `orderBy`, `ascending`,
// and `filterKey` (an optional string you can pass to force a refetch when
// the *meaning* of the filter changes) affect when data is reloaded.
export function useTable(table, { select = '*', orderBy = 'created_at', ascending = false, filter, filterKey } = {}) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const filterRef = useRef(filter)
  filterRef.current = filter

  const refresh = useCallback(async () => {
    setLoading(true)
    let query = supabase.from(table).select(select).order(orderBy, { ascending })
    if (filterRef.current) query = filterRef.current(query)
    const { data, error } = await query
    if (error) setError(error)
    else setRows(data || [])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, select, orderBy, ascending, filterKey])

  useEffect(() => { refresh() }, [refresh])

  const insert = async (record) => {
    const { data, error } = await supabase.from(table).insert(record).select().single()
    if (!error) await refresh()
    return { data, error }
  }

  const update = async (id, patch) => {
    const { data, error } = await supabase.from(table).update(patch).eq('id', id).select().single()
    if (!error) await refresh()
    return { data, error }
  }

  const remove = async (id) => {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (!error) await refresh()
    return { error }
  }

  return { rows, loading, error, refresh, insert, update, remove }
}
