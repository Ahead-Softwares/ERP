import { Badge } from "@/components/ui/badge"
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/console"

export function OrderBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant={status === "paid" ? "default" : status === "pending_approval" ? "destructive" : status === "cancelled" ? "outline" : "secondary"}>
      {ORDER_STATUS_LABEL[status]}
    </Badge>
  )
}
