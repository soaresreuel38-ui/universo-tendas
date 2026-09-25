import { Badge } from "@/components/ui/primitives";
import { RENTAL_STATUS_LABEL, RENTAL_STATUS_TONE, effectiveStatus, type RentalStatus } from "@/lib/domain";

export function RentalStatusBadge({ rental }: { rental: { status: RentalStatus; expectedReturnAt: Date } }) {
  const s = effectiveStatus(rental);
  return <Badge tone={RENTAL_STATUS_TONE[s]}>{RENTAL_STATUS_LABEL[s]}</Badge>;
}
