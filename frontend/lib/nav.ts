import {
  BarChart3,
  Bell,
  CalendarDays,
  CheckSquare,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  Package,
  Receipt,
  Sparkles,
  UserCog,
  Users,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react"
import type { ModuleKey } from "@/lib/types"

export interface ModuleNav {
  key: ModuleKey
  label: string
  /** Terminology key whose plural replaces the label, e.g. Customers → Clients */
  termKey?: string
  icon: LucideIcon
  description: string
  /** Release phase from the PRD; used for "coming soon" screens */
  phase: 1 | 2 | 3
}

export const MODULE_NAV: ModuleNav[] = [
  { key: "crm", label: "CRM", termKey: "entity.contact.plural", icon: Users, description: "Contacts, leads, notes, calls and follow-ups", phase: 1 },
  { key: "catalog", label: "Products & Services", termKey: "entity.item.plural", icon: Package, description: "Your shared catalogue with GST rates and HSN/SAC", phase: 1 },
  { key: "sales", label: "Sales & Orders", icon: FileText, description: "Quotations, sales orders, deliveries and returns", phase: 1 },
  { key: "billing", label: "Billing", icon: Receipt, description: "GST invoices, receipts, dues and POS", phase: 1 },
  { key: "bookings", label: "Calendar & Bookings", termKey: "entity.appointment.plural", icon: CalendarDays, description: "Team calendar, appointments and resources", phase: 1 },
  { key: "tasks", label: "Tasks", icon: CheckSquare, description: "Tasks, checklists and approvals", phase: 1 },
  { key: "finance", label: "Expenses & Finance", icon: Wallet, description: "Expenses, ledgers and financial statements", phase: 2 },
  { key: "inventory", label: "Inventory", icon: Warehouse, description: "Stock, warehouses, purchasing and assets", phase: 2 },
  { key: "hr", label: "HR & Payroll", icon: UserCog, description: "Employees, attendance, leave and payroll", phase: 2 },
  { key: "support", label: "Customer Service", icon: LifeBuoy, description: "Tickets, SLAs and complaints", phase: 3 },
  { key: "reports", label: "Reports", icon: BarChart3, description: "Dashboards and standard reports", phase: 3 },
  { key: "ai", label: "AI Assistant", icon: Sparkles, description: "Ask questions about your business in plain language", phase: 3 },
  { key: "automation", label: "Automation", icon: Bell, description: "Notifications, reminders and rules", phase: 3 },
]

export const DASHBOARD_NAV = { label: "Dashboard", icon: LayoutDashboard }
