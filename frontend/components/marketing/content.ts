// Homepage copy that is also used for structured data (FAQPage, SoftwareApplication features)

export const FAQS = [
  {
    q: "What is AHEAD ERP?",
    a: "AHEAD ERP is cloud software that runs the day-to-day of a small or mid-sized Indian business in one place: GST invoices and receipts, customers and leads, quotations, bookings, tasks, your team, expenses and reports — with stock, HR and more on the way. You open it in the browser on a laptop or phone — nothing to install.",
  },
  {
    q: "How does the 15-day free trial work?",
    a: "Sign up with your mobile number, pick your industry and you get every module unlocked for 15 days. No card is needed. When the trial ends you can choose a paid plan, or carry on with the Free plan — your data stays exactly where it is.",
  },
  {
    q: "Is there really a free plan?",
    a: "Yes. The Free plan is free forever and covers the basics for a small team: up to 3 users, 1 branch, 1,000 contacts and 100 invoices a month, with CRM, billing, catalogue, tasks, bookings, expenses and reports at the basic tier.",
  },
  {
    q: "Are the invoices GST compliant?",
    a: "Invoices carry your GSTIN, HSN/SAC codes and the right tax split automatically — CGST and SGST for sales within your state, IGST for interstate sales — with financial-year invoice numbering like INV/26-27/0001. Credit notes, receipts and dues are linked to the original invoice.",
  },
  {
    q: "Which businesses is it built for?",
    a: "AHEAD comes with ready templates for salons and spas, retail shops, pharmacies, gyms and fitness studios, coaching institutes and schools, and service companies. Each template sets up the right fields, terms and sample items, and you can rename or add fields to match how you work.",
  },
  {
    q: "Can my team use it, and control who sees what?",
    a: "Yes. Invite staff by mobile or email and give each person a role — owner, manager, accountant, cashier, front desk, stylist, trainer and many more ready-made roles. Roles decide which screens and actions someone can use, and every important change is written to an audit log.",
  },
  {
    q: "Is my business data safe?",
    a: "Every business gets its own isolated workspace enforced inside the database, so one company can never read another's records. Passwords are hashed, access is checked on every request, and important changes are written to an audit log.",
  },
  {
    q: "Can I move from Excel or my current software?",
    a: "Yes. Import your customers from a CSV file (Excel can save one) and add your products and services, and you can start billing the same day.",
  },
  {
    q: "Can I change my plan later?",
    a: "Anytime. Upgrade when you need more users, branches or modules such as Inventory, HR and the AI assistant as they launch, or add a single module on its own. Prices are shown in rupees and invoiced with GST.",
  },
] as const

export const MODULES = [
  { name: "CRM & leads", status: "live" },
  { name: "GST invoices & receipts", status: "live" },
  { name: "Quotations", status: "live" },
  { name: "Products & services", status: "live" },
  { name: "Calendar & bookings", status: "live" },
  { name: "Tasks", status: "live" },
  { name: "Expenses", status: "live" },
  { name: "Dashboard & reports", status: "live" },
  { name: "Industry templates", status: "live" },
  { name: "Roles & audit log", status: "live" },
  { name: "Custom fields", status: "live" },
  { name: "Multiple branches", status: "live" },
  { name: "Inventory & purchasing", status: "soon" },
  { name: "Batch & expiry tracking", status: "soon" },
  { name: "Payment reminders", status: "soon" },
  { name: "POS counter", status: "soon" },
  { name: "HR, attendance & payroll", status: "soon" },
  { name: "Support tickets", status: "soon" },
  { name: "AI business assistant", status: "soon" },
  { name: "Accounting & GST reports", status: "soon" },
] as const
