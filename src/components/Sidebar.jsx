import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard, Package, Users, Truck, ClipboardList, FileText,
  ShoppingCart, Inbox, CheckSquare, ArrowDownToLine, Factory, Layers,
  Wind, PackageCheck, Boxes, Send, Trash2, GitBranch, Calculator,
  UserCog, LogOut, X
} from 'lucide-react'

const ICONS = {
  material_master: Package,
  suppliers: Users,
  customers: Truck,
  stock_register: ClipboardList,
  purchase_requisition: FileText,
  purchase_order: ShoppingCart,
  grn: Inbox,
  incoming_qc: CheckSquare,
  material_issue: ArrowDownToLine,
  production_planning: Factory,
  wip: Layers,
  sterilization: Wind,
  final_qc: CheckSquare,
  packing: PackageCheck,
  finished_goods: Boxes,
  dispatch: Send,
  scrap_register: Trash2,
  batch_traceability: GitBranch,
  inventory_dashboard: LayoutDashboard,
  master_dashboard: LayoutDashboard,
  stock_calculator: Calculator,
  user_management: UserCog,
}

const ROUTES = {
  material_master: '/setup/material-master',
  suppliers: '/setup/suppliers',
  customers: '/setup/customers',
  stock_register: '/procurement/stock-register',
  purchase_requisition: '/procurement/purchase-requisitions',
  purchase_order: '/procurement/purchase-orders',
  grn: '/procurement/grn',
  incoming_qc: '/quality/incoming-qc',
  material_issue: '/production/material-issue',
  production_planning: '/production/planning',
  wip: '/production/wip',
  sterilization: '/production/sterilization',
  final_qc: '/quality/final-qc',
  packing: '/production/packing',
  finished_goods: '/dispatch/finished-goods',
  dispatch: '/dispatch/dispatch',
  scrap_register: '/quality/scrap',
  batch_traceability: '/reports/traceability',
  inventory_dashboard: '/reports/inventory-dashboard',
  master_dashboard: '/reports/master-dashboard',
  stock_calculator: '/reports/stock-calculator',
  user_management: '/admin/users',
}

export default function Sidebar({ open, onClose }) {
  const { modules, can, isAdmin, profile, signOut } = useAuth()

  const visibleModules = modules.filter((m) => can(m.id, 'view'))
  const grouped = visibleModules.reduce((acc, m) => {
    acc[m.module_group] = acc[m.module_group] || []
    acc[m.module_group].push(m)
    return acc
  }, {})

  const groupOrder = ['Setup', 'Procurement', 'Quality', 'Production', 'Dispatch', 'Reports', 'Admin']

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed lg:static z-40 top-0 left-0 h-full w-72 bg-[#024886] text-white flex flex-col transition-transform duration-200
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
          <div>
            <p className="font-semibold text-lg leading-tight">Sterix Operations</p>
            <p className="text-xs text-sky-200/80">SAFE · STERILE · STERIX</p>
          </div>
          <button onClick={onClose} className="lg:hidden text-white/70 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {groupOrder.map((group) => {
            const items = grouped[group]
            if (!items || items.length === 0) return null
            return (
              <div key={group}>
                <p className="text-xs font-semibold text-sky-200/70 uppercase tracking-wide px-3 mb-1.5">
                  {group}
                </p>
                <div className="space-y-0.5">
                  {items.map((m) => {
                    const Icon = ICONS[m.id] || FileText
                    return (
                      <NavLink
                        key={m.id}
                        to={ROUTES[m.id] || '#'}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                            isActive
                              ? 'bg-white/15 text-white font-medium'
                              : 'text-sky-100/85 hover:bg-white/10 hover:text-white'
                          }`
                        }
                      >
                        <Icon size={17} />
                        {m.label}
                      </NavLink>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        <div className="border-t border-white/10 px-4 py-4">
          <p className="text-sm font-medium truncate">{profile?.full_name || 'User'}</p>
          <p className="text-xs text-sky-200/70 truncate">{isAdmin ? 'Administrator' : 'Team Member'}</p>
          <button
            onClick={signOut}
            className="mt-3 flex items-center gap-2 text-sm text-sky-100/85 hover:text-white"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
