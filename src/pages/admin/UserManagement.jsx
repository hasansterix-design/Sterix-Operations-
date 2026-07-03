import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useTable } from '../../lib/useTable'
import { supabase } from '../../lib/supabase'
import { PageHeader, Button, Table, EmptyState, Modal, Field, inputClass, Badge, Card } from '../../components/ui'
import { Plus, Shield, Settings } from 'lucide-react'

export default function UserManagement() {
  const { isAdmin, profile } = useAuth()
  const { rows: users, loading, refresh } = useTable('app_users', { orderBy: 'created_at', ascending: true })
  const { rows: modules } = useTable('modules', { orderBy: 'sort_order', ascending: true })

  const [createOpen, setCreateOpen] = useState(false)
  const [permOpen, setPermOpen] = useState(null) // user row being edited
  const [permMap, setPermMap] = useState({})
  const [saving, setSaving] = useState(false)
  const [createForm, setCreateForm] = useState({ full_name: '', email: '', password: '', is_admin: false })

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <Shield className="text-slate-300 mb-3" size={40} />
        <p className="text-lg font-medium text-slate-700">Admin access required</p>
        <p className="text-sm text-slate-500 mt-1">Only administrators can manage users and permissions.</p>
      </div>
    )
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    setSaving(true)

    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData?.session?.access_token

    const { data, error } = await supabase.functions.invoke('create-user', {
      body: {
        full_name: createForm.full_name,
        email: createForm.email,
        password: createForm.password,
        is_admin: createForm.is_admin,
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    setSaving(false)

    if (error || data?.error) {
      alert(data?.error || error?.message || 'Failed to create user')
      return
    }

    setCreateOpen(false)
    setCreateForm({ full_name: '', email: '', password: '', is_admin: false })
    refresh()
  }

  const openPermissions = async (user) => {
    const { data } = await supabase.from('user_permissions').select('module_id, access_level').eq('user_id', user.id)
    const map = {}
    modules.forEach((m) => { map[m.id] = 'none' })
    ;(data || []).forEach((p) => { map[p.module_id] = p.access_level })
    setPermMap(map)
    setPermOpen(user)
  }

  const setLevel = (moduleId, level) => setPermMap((m) => ({ ...m, [moduleId]: level }))

  const savePermissions = async () => {
    setSaving(true)
    const rows = Object.entries(permMap).map(([module_id, access_level]) => ({
      user_id: permOpen.id, module_id, access_level, granted_by: profile?.id, updated_at: new Date().toISOString(),
    }))
    const { error } = await supabase.from('user_permissions').upsert(rows, { onConflict: 'user_id,module_id' })
    setSaving(false)
    if (error) alert(error.message)
    else setPermOpen(null)
  }

  const toggleAdmin = async (user) => {
    if (user.id === profile?.id && user.is_admin) {
      if (!confirm('Remove your own admin access? You will lose full access immediately.')) return
    }
    await supabase.from('app_users').update({ is_admin: !user.is_admin }).eq('id', user.id)
    refresh()
  }

  const toggleActive = async (user) => {
    await supabase.from('app_users').update({ is_active: !user.is_active }).eq('id', user.id)
    refresh()
  }

  return (
    <div>
      <PageHeader
        title="User & Permission Management"
        description="Create users, grant or revoke per-module access, and assign additional admins."
        action={<Button onClick={() => setCreateOpen(true)}><Plus size={16} /> Add User</Button>}
      />

      <Table columns={['Name', 'Email', 'Role', 'Status', '']}>
        {loading ? (
          <EmptyState message="Loading..." />
        ) : users.length === 0 ? (
          <EmptyState message="No users yet." />
        ) : (
          users.map((u) => (
            <tr key={u.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-800">{u.full_name}</td>
              <td className="px-4 py-3 text-slate-500">{u.email}</td>
              <td className="px-4 py-3">
                <button onClick={() => toggleAdmin(u)}>
                  <Badge tone={u.is_admin ? 'blue' : 'slate'}>{u.is_admin ? 'Admin' : 'Team Member'}</Badge>
                </button>
              </td>
              <td className="px-4 py-3">
                <button onClick={() => toggleActive(u)}>
                  <Badge tone={u.is_active ? 'green' : 'red'}>{u.is_active ? 'Active' : 'Disabled'}</Badge>
                </button>
              </td>
              <td className="px-4 py-3 text-right">
                {!u.is_admin && (
                  <button onClick={() => openPermissions(u)} className="text-slate-400 hover:text-[#024886]" title="Manage permissions">
                    <Settings size={16} />
                  </button>
                )}
              </td>
            </tr>
          ))
        )}
      </Table>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add New User">
        <form onSubmit={handleCreateUser} className="space-y-4">
          <Field label="Full Name" required>
            <input className={inputClass} required value={createForm.full_name} onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })} />
          </Field>
          <Field label="Email" required>
            <input type="email" className={inputClass} required value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
          </Field>
          <Field label="Temporary Password" required>
            <input type="text" className={inputClass} required minLength={6} value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} placeholder="At least 6 characters" />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={createForm.is_admin} onChange={(e) => setCreateForm({ ...createForm, is_admin: e.target.checked })} />
            Grant full admin access
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create User'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!permOpen} onClose={() => setPermOpen(null)} title={`Permissions — ${permOpen?.full_name || ''}`} wide>
        {permOpen && (
          <div className="space-y-4">
            <Card className="p-3 bg-slate-50 text-xs text-slate-500">
              Set access per module: <strong>None</strong> hides it entirely, <strong>View</strong> allows read-only, <strong>Edit</strong> allows full create/update/delete.
            </Card>
            <div className="space-y-1 max-h-[50vh] overflow-y-auto">
              {modules.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{m.label}</p>
                    <p className="text-xs text-slate-400">{m.module_group}</p>
                  </div>
                  <div className="flex rounded-lg border border-slate-300 overflow-hidden text-xs">
                    {['none', 'view', 'edit'].map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setLevel(m.id, level)}
                        className={`px-3 py-1.5 capitalize ${permMap[m.id] === level ? 'bg-[#024886] text-white' : 'bg-white text-slate-600'}`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" type="button" onClick={() => setPermOpen(null)}>Cancel</Button>
              <Button onClick={savePermissions} disabled={saving}>{saving ? 'Saving...' : 'Save Permissions'}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
