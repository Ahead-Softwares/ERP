import type { ModuleKey } from './modules';

// Industry templates (CFG-01, CFG-07). Versioned; a tenant pins the version it started with.

export interface TemplateField {
  entity: string;
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'dropdown' | 'multi_select' | 'checkbox';
  options?: string[];
  required?: boolean;
}

export interface CatalogSeedItem {
  name: string;
  type: 'product' | 'service';
  pricePaise: number;
  gstRateBp: number; // 1800 = 18%
  durationMin?: number;
  hsnSac?: string;
}

export interface TemplateDef {
  key: string;
  version: number;
  name: string;
  description: string;
  /** Recommended modules, shown first in navigation */
  modules: ModuleKey[];
  terms: Record<string, string>;
  fields: TemplateField[];
  dashboard: string[];
  catalogSeed: CatalogSeedItem[];
}

/** Default terminology; templates override only what differs. */
export const DEFAULT_TERMS: Record<string, string> = {
  'entity.contact.singular': 'Customer',
  'entity.contact.plural': 'Customers',
  'entity.lead.singular': 'Lead',
  'entity.lead.plural': 'Leads',
  'entity.item.singular': 'Item',
  'entity.item.plural': 'Items',
  'entity.appointment.singular': 'Appointment',
  'entity.appointment.plural': 'Appointments',
  'entity.order.singular': 'Order',
  'entity.order.plural': 'Orders',
  'entity.employee.singular': 'Employee',
  'entity.employee.plural': 'Employees',
  'role.service_provider': 'Service Provider',
};

export const TEMPLATES: TemplateDef[] = [
  {
    key: 'salon', version: 1, name: 'Salon & Spa', description: 'Appointments, stylists, services and memberships',
    modules: ['bookings', 'crm', 'billing', 'catalog', 'hr', 'inventory', 'tasks'],
    terms: { 'entity.contact.singular': 'Client', 'entity.contact.plural': 'Clients', 'entity.item.plural': 'Services & Products', 'role.service_provider': 'Stylist' },
    fields: [
      { entity: 'contact', key: 'hair_type', label: 'Hair type', type: 'dropdown', options: ['Straight', 'Wavy', 'Curly', 'Coily'] },
      { entity: 'contact', key: 'skin_type', label: 'Skin type', type: 'dropdown', options: ['Normal', 'Dry', 'Oily', 'Combination', 'Sensitive'] },
      { entity: 'contact', key: 'birthday', label: 'Birthday', type: 'date' },
    ],
    dashboard: ['today_bookings', 'daily_sales', 'repeat_clients', 'pending_tasks'],
    catalogSeed: [
      { name: 'Haircut', type: 'service', pricePaise: 50000, gstRateBp: 1800, durationMin: 30, hsnSac: '999721' },
      { name: 'Hair Spa', type: 'service', pricePaise: 120000, gstRateBp: 1800, durationMin: 60, hsnSac: '999721' },
      { name: 'Facial', type: 'service', pricePaise: 150000, gstRateBp: 1800, durationMin: 45, hsnSac: '999722' },
    ],
  },
  {
    key: 'retail', version: 1, name: 'Retail Shop', description: 'Billing counter, stock and suppliers',
    modules: ['billing', 'catalog', 'inventory', 'crm', 'finance', 'reports'],
    terms: {},
    fields: [
      { entity: 'item', key: 'brand', label: 'Brand', type: 'text' },
      { entity: 'item', key: 'size', label: 'Size', type: 'text' },
    ],
    dashboard: ['daily_sales', 'low_stock', 'dues', 'top_items'],
    catalogSeed: [],
  },
  {
    key: 'pharmacy', version: 1, name: 'Pharmacy', description: 'Medicines with batch and expiry, prescriptions',
    modules: ['billing', 'catalog', 'inventory', 'crm', 'finance', 'reports'],
    terms: { 'entity.contact.singular': 'Patient', 'entity.contact.plural': 'Patients', 'entity.item.singular': 'Medicine', 'entity.item.plural': 'Medicines' },
    fields: [
      { entity: 'item', key: 'manufacturer', label: 'Manufacturer', type: 'text' },
      { entity: 'item', key: 'schedule', label: 'Drug schedule', type: 'dropdown', options: ['OTC', 'H', 'H1', 'X'] },
      { entity: 'item', key: 'composition', label: 'Composition', type: 'text' },
      { entity: 'contact', key: 'doctor_name', label: 'Doctor name', type: 'text' },
    ],
    dashboard: ['daily_sales', 'near_expiry', 'low_stock', 'dues'],
    catalogSeed: [],
  },
  {
    key: 'gym', version: 1, name: 'Gym & Fitness', description: 'Members, trainers, classes and renewals',
    modules: ['bookings', 'crm', 'billing', 'catalog', 'hr', 'automation'],
    terms: { 'entity.contact.singular': 'Member', 'entity.contact.plural': 'Members', 'role.service_provider': 'Trainer', 'entity.appointment.singular': 'Session', 'entity.appointment.plural': 'Sessions' },
    fields: [
      { entity: 'contact', key: 'fitness_goal', label: 'Fitness goal', type: 'dropdown', options: ['Weight loss', 'Muscle gain', 'Endurance', 'General fitness'] },
      { entity: 'contact', key: 'membership_end', label: 'Membership end date', type: 'date' },
      { entity: 'contact', key: 'medical_notes', label: 'Medical notes', type: 'text' },
    ],
    dashboard: ['today_bookings', 'renewals_due', 'daily_sales', 'new_members'],
    catalogSeed: [
      { name: 'Monthly Membership', type: 'service', pricePaise: 150000, gstRateBp: 1800, hsnSac: '999723' },
      { name: 'Personal Training Session', type: 'service', pricePaise: 80000, gstRateBp: 1800, durationMin: 60, hsnSac: '999723' },
    ],
  },
  {
    key: 'school', version: 1, name: 'Coaching / School', description: 'Students, teachers, batches and fees',
    modules: ['crm', 'billing', 'bookings', 'hr', 'tasks', 'reports'],
    terms: { 'entity.contact.singular': 'Student', 'entity.contact.plural': 'Students', 'entity.lead.singular': 'Enquiry', 'entity.lead.plural': 'Enquiries', 'role.service_provider': 'Teacher', 'entity.order.singular': 'Admission', 'entity.order.plural': 'Admissions', 'entity.appointment.singular': 'Class', 'entity.appointment.plural': 'Classes' },
    fields: [
      { entity: 'contact', key: 'guardian_name', label: 'Guardian name', type: 'text' },
      { entity: 'contact', key: 'guardian_phone', label: 'Guardian phone', type: 'text' },
      { entity: 'contact', key: 'batch', label: 'Batch / Class', type: 'text' },
    ],
    dashboard: ['fees_due', 'today_bookings', 'new_enquiries', 'pending_tasks'],
    catalogSeed: [{ name: 'Monthly Tuition Fee', type: 'service', pricePaise: 200000, gstRateBp: 1800, hsnSac: '999293' }],
  },
  {
    key: 'services', version: 1, name: 'Service Company', description: 'Clients, jobs, tasks, support and invoices',
    modules: ['crm', 'sales', 'billing', 'tasks', 'support', 'finance'],
    terms: { 'entity.contact.singular': 'Client', 'entity.contact.plural': 'Clients', 'entity.order.singular': 'Service Order', 'entity.order.plural': 'Service Orders' },
    fields: [
      { entity: 'contact', key: 'industry', label: 'Industry', type: 'text' },
      { entity: 'contact', key: 'contract_end', label: 'Contract end date', type: 'date' },
    ],
    dashboard: ['daily_sales', 'dues', 'open_tickets', 'pending_tasks'],
    catalogSeed: [{ name: 'Consulting (per hour)', type: 'service', pricePaise: 250000, gstRateBp: 1800, hsnSac: '998311' }],
  },
];

export const templateByKey = (key: string) => TEMPLATES.find((t) => t.key === key);
