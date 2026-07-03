import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { RequireAuth, RequireModule } from './components/Guards'
import AppLayout from './components/AppLayout'
import Login from './pages/Login'

import MaterialMaster from './pages/setup/MaterialMaster'
import Suppliers from './pages/setup/Suppliers'
import Customers from './pages/setup/Customers'

import StockRegister from './pages/procurement/StockRegister'
import PurchaseRequisitions from './pages/procurement/PurchaseRequisitions'
import PurchaseOrders from './pages/procurement/PurchaseOrders'
import GRN from './pages/procurement/GRN'

import IncomingQC from './pages/quality/IncomingQC'
import FinalQC from './pages/quality/FinalQC'
import ScrapRegister from './pages/quality/ScrapRegister'

import MaterialIssue from './pages/production/MaterialIssue'
import ProductionPlanning from './pages/production/ProductionPlanning'
import WipInventory from './pages/production/WipInventory'
import Sterilization from './pages/production/Sterilization'
import Packing from './pages/production/Packing'

import FinishedGoodsInventory from './pages/dispatch/FinishedGoodsInventory'
import Dispatch from './pages/dispatch/Dispatch'

import BatchTraceability from './pages/reports/BatchTraceability'
import InventoryDashboard from './pages/reports/InventoryDashboard'
import MasterDashboard from './pages/reports/MasterDashboard'
import StockCalculator from './pages/reports/StockCalculator'

import UserManagement from './pages/admin/UserManagement'

function Wrapped({ moduleId, children }) {
  return <RequireModule moduleId={moduleId}>{children}</RequireModule>
}

function HomeRedirect() {
  const { modules, can, isAdmin } = useAuth()
  if (isAdmin) return <Navigate to="/reports/master-dashboard" replace />
  const firstAccessible = modules.find((m) => can(m.id, 'view'))
  if (firstAccessible) {
    const map = {
      material_master: '/setup/material-master', suppliers: '/setup/suppliers', customers: '/setup/customers',
      stock_register: '/procurement/stock-register', purchase_requisition: '/procurement/purchase-requisitions',
      purchase_order: '/procurement/purchase-orders', grn: '/procurement/grn', incoming_qc: '/quality/incoming-qc',
      material_issue: '/production/material-issue', production_planning: '/production/planning',
      wip: '/production/wip', sterilization: '/production/sterilization', final_qc: '/quality/final-qc',
      packing: '/production/packing', finished_goods: '/dispatch/finished-goods', dispatch: '/dispatch/dispatch',
      scrap_register: '/quality/scrap', batch_traceability: '/reports/traceability',
      inventory_dashboard: '/reports/inventory-dashboard', master_dashboard: '/reports/master-dashboard',
      stock_calculator: '/reports/stock-calculator', user_management: '/admin/users',
    }
    return <Navigate to={map[firstAccessible.id] || '/login'} replace />
  }
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
      <p className="text-lg font-medium text-slate-700">No modules assigned yet</p>
      <p className="text-sm text-slate-500 mt-1">Ask an admin to grant you access to get started.</p>
    </div>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<HomeRedirect />} />

        <Route path="setup/material-master" element={<Wrapped moduleId="material_master"><MaterialMaster /></Wrapped>} />
        <Route path="setup/suppliers" element={<Wrapped moduleId="suppliers"><Suppliers /></Wrapped>} />
        <Route path="setup/customers" element={<Wrapped moduleId="customers"><Customers /></Wrapped>} />

        <Route path="procurement/stock-register" element={<Wrapped moduleId="stock_register"><StockRegister /></Wrapped>} />
        <Route path="procurement/purchase-requisitions" element={<Wrapped moduleId="purchase_requisition"><PurchaseRequisitions /></Wrapped>} />
        <Route path="procurement/purchase-orders" element={<Wrapped moduleId="purchase_order"><PurchaseOrders /></Wrapped>} />
        <Route path="procurement/grn" element={<Wrapped moduleId="grn"><GRN /></Wrapped>} />

        <Route path="quality/incoming-qc" element={<Wrapped moduleId="incoming_qc"><IncomingQC /></Wrapped>} />
        <Route path="quality/final-qc" element={<Wrapped moduleId="final_qc"><FinalQC /></Wrapped>} />
        <Route path="quality/scrap" element={<Wrapped moduleId="scrap_register"><ScrapRegister /></Wrapped>} />

        <Route path="production/material-issue" element={<Wrapped moduleId="material_issue"><MaterialIssue /></Wrapped>} />
        <Route path="production/planning" element={<Wrapped moduleId="production_planning"><ProductionPlanning /></Wrapped>} />
        <Route path="production/wip" element={<Wrapped moduleId="wip"><WipInventory /></Wrapped>} />
        <Route path="production/sterilization" element={<Wrapped moduleId="sterilization"><Sterilization /></Wrapped>} />
        <Route path="production/packing" element={<Wrapped moduleId="packing"><Packing /></Wrapped>} />

        <Route path="dispatch/finished-goods" element={<Wrapped moduleId="finished_goods"><FinishedGoodsInventory /></Wrapped>} />
        <Route path="dispatch/dispatch" element={<Wrapped moduleId="dispatch"><Dispatch /></Wrapped>} />

        <Route path="reports/traceability" element={<Wrapped moduleId="batch_traceability"><BatchTraceability /></Wrapped>} />
        <Route path="reports/inventory-dashboard" element={<Wrapped moduleId="inventory_dashboard"><InventoryDashboard /></Wrapped>} />
        <Route path="reports/master-dashboard" element={<Wrapped moduleId="master_dashboard"><MasterDashboard /></Wrapped>} />
        <Route path="reports/stock-calculator" element={<Wrapped moduleId="stock_calculator"><StockCalculator /></Wrapped>} />

        <Route path="admin/users" element={<UserManagement />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
