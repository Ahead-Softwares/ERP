"use client"

import { TaxesStep } from "@/components/setup/taxes-step"
import { SettingsStepPage } from "@/components/settings-step-page"

export default function TaxesSettingsPage() {
  return <SettingsStepPage title="Taxes" description="GST scheme, default rate and HSN digits used on new invoices. Issued invoices never change." stepKey="taxes" Step={TaxesStep} anchor="gst" />
}
