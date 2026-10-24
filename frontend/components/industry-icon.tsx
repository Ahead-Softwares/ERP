import {
  BedDouble,
  Briefcase,
  Dumbbell,
  Factory,
  FlaskConical,
  Gem,
  Glasses,
  GraduationCap,
  HardHat,
  HeartHandshake,
  Pill,
  Plane,
  Scale,
  Scissors,
  Shapes,
  Shirt,
  Smartphone,
  Stethoscope,
  Store,
  Truck,
  UtensilsCrossed,
  Warehouse,
  Wrench,
  type LucideIcon,
} from "lucide-react"

const ICONS: Record<string, LucideIcon> = {
  retail: Store,
  wholesale: Warehouse,
  pharmacy: Pill,
  apparel: Shirt,
  electronics: Smartphone,
  jewellery: Gem,
  optical: Glasses,
  salon: Scissors,
  gym: Dumbbell,
  clinic: Stethoscope,
  lab: FlaskConical,
  restaurant: UtensilsCrossed,
  hotel: BedDouble,
  services: Briefcase,
  professional: Scale,
  repairs: Wrench,
  travel: Plane,
  logistics: Truck,
  school: GraduationCap,
  manufacturing: Factory,
  construction: HardHat,
  ngo: HeartHandshake,
}

/** Icon for an industry key from contracts/workspace INDUSTRIES. */
export function IndustryIcon({ industry, className }: { industry: string; className?: string }) {
  const Icon = ICONS[industry] ?? Shapes
  return <Icon className={className} aria-hidden />
}
