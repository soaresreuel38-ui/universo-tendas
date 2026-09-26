import { Badge } from "@/components/ui/primitives";
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TONE, effectiveContractStatus, type ContractStatus } from "@/lib/domain";

export function ContractStatusBadge({
  contract,
}: {
  contract: { status: ContractStatus; rental?: { departureAt: Date; departedAt: Date | null } | null };
}) {
  const s = effectiveContractStatus(contract);
  return <Badge tone={CONTRACT_STATUS_TONE[s]}>{CONTRACT_STATUS_LABEL[s]}</Badge>;
}
