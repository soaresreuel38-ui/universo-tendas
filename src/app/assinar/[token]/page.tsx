import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import type { ContractSnapshot } from "@/lib/contract-types";
import { fmtDateTime, money, seq } from "@/lib/format";
import { findContractByToken } from "@/server/contracts";
import { prisma } from "@/server/db";
import { publicSignAction } from "./actions";
import { PublicSignForm } from "./SignForm";

export const metadata: Metadata = { title: "Assinatura de contrato", robots: { index: false, follow: false } };

export default async function PublicSignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const c = await findContractByToken(prisma, token);
  const shell = (children: React.ReactNode) => (
    <main className="min-h-dvh bg-zinc-100">
      <header className="bg-ink px-4 py-4 text-white">
        <div className="mx-auto max-w-2xl">
          <Logo />
        </div>
      </header>
      <div className="mx-auto max-w-2xl p-4">{children}</div>
    </main>
  );
  if (!c) {
    return shell(
      <div className="rounded-lg bg-white p-6 text-center">
        <h1 className="text-lg font-semibold">Link inválido ou expirado</h1>
        <p className="mt-2 text-sm text-zinc-600">Peça um novo link à Universo Tendas.</p>
      </div>,
    );
  }
  const snap = c.snapshot as unknown as ContractSnapshot;
  const clientSigned = c.signatures.some((s) => s.party === "CLIENTE");
  return shell(
    <div className="space-y-4">
      <div className="rounded-lg bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Contrato de locação</p>
        <h1 className="mt-1 text-xl font-semibold">Contrato #{seq(c.number)}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {snap.customer.name} · {snap.rental.eventName}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-zinc-500">Saída</dt>
            <dd>{fmtDateTime(new Date(snap.rental.departureAt))}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Retorno previsto</dt>
            <dd>{fmtDateTime(new Date(snap.rental.expectedReturnAt))}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-zinc-500">Produtos</dt>
            <dd>{snap.items.map((i) => `${i.quantity} ${i.unit} ${i.name}`).join(" · ")}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Total</dt>
            <dd className="text-lg font-semibold">{money(snap.totalCents)}</dd>
          </div>
        </dl>
        <a href={`/assinar/${token}/pdf`} target="_blank" rel="noopener" className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-md border border-zinc-300 font-medium">
          Ler o contrato completo (PDF)
        </a>
      </div>
      <div className="rounded-lg bg-white p-5">
        {clientSigned ? (
          <p className="text-center text-emerald-700">Você já assinou este contrato. Obrigado!</p>
        ) : (
          <PublicSignForm token={token} name={snap.customer.name} document={snap.customer.document} action={publicSignAction} />
        )}
      </div>
      <p className="text-center text-xs text-zinc-500">
        {snap.company.name} · {snap.company.city} · {snap.company.phones}
      </p>
    </div>,
  );
}
