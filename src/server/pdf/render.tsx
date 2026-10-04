import "server-only";
import { BILLING_LABEL, periodLabel, type BillingMode } from "@/lib/billing";
import { renderToBuffer } from "@react-pdf/renderer";
import type { ContractSnapshot } from "@/lib/contract-types";
import { PAYMENT_METHOD_LABEL } from "@/lib/domain";
import { fmtDateTime } from "@/lib/format";
import { getContractTemplate } from "../contracts";
import { prisma } from "../db";
import type { SignatureView } from "./components";
import { ContractPdf, QuotePdf, SaleReceiptPdf } from "./documents";

async function company() {
  const t = await getContractTemplate(prisma);
  return { name: t.companyName, cnpj: t.cnpj, address: t.address, city: t.city, phones: t.phones, email: t.email, instagram: t.instagram };
}

export async function contractPdf(contractId: string): Promise<{ buffer: Buffer; fileName: string } | null> {
  const c = await prisma.contract.findUnique({ where: { id: contractId }, include: { signatures: true } });
  if (!c) return null;
  const snap = c.snapshot as unknown as ContractSnapshot;
  const sig = (party: "CLIENTE" | "EMPRESA", role: string, fallbackName: string, fallbackDoc: string | null): SignatureView => {
    const x = c.signatures.find((s) => s.party === party);
    if (!x) return { role, name: fallbackName, document: fallbackDoc };
    return {
      role,
      name: x.signerName,
      document: x.signerDocument ?? fallbackDoc,
      imageDataUri: x.imageData ? `data:image/png;base64,${Buffer.from(x.imageData).toString("base64")}` : null,
      meta: x.method === "DIGITAL" ? `Assinado eletronicamente em ${fmtDateTime(x.signedAt)}` : `Assinado em papel · registrado em ${fmtDateTime(x.signedAt)}`,
    };
  };
  const buffer = await renderToBuffer(
    <ContractPdf
      snapshot={snap}
      number={c.number}
      createdAt={c.createdAt}
      contentHash={c.contentHash}
      status={c.status}
      signatures={[
        sig("CLIENTE", "Contratante", snap.customer.name, snap.customer.document),
        sig("EMPRESA", "Contratada", snap.company.name, snap.company.cnpj),
      ]}
    />,
  );
  return { buffer, fileName: `contrato-${String(c.number).padStart(6, "0")}.pdf` };
}

const modalidade = (mode: BillingMode | undefined, n: number | undefined) => (mode ? `${BILLING_LABEL[mode]} — ${periodLabel(mode, n ?? 1)}` : null);

export async function quotePdf(rentalId: string) {
  const r = await prisma.rental.findUnique({
    where: { id: rentalId },
    include: { customer: true, items: { include: { product: true }, orderBy: { product: { name: "asc" } } } },
  });
  if (!r) return null;
  const template = await getContractTemplate(prisma);
  const items = r.items.map((i) => ({
    quantity: i.quantity,
    code: i.product.sku,
    name: i.product.name,
    unit: i.product.unit,
    unitPriceCents: i.unitPriceCents,
    totalCents: i.quantity * i.unitPriceCents,
  }));
  const buffer = await renderToBuffer(
    <QuotePdf
      q={{
        company: await company(),
        number: r.number,
        createdAt: r.createdAt,
        customer: { name: r.customer.name, document: r.customer.document, phone: r.customer.phone, whatsapp: r.customer.whatsapp, email: r.customer.email, address: r.customer.address, city: r.customer.city },
        eventName: r.eventName,
        eventAddress: r.eventAddress,
        departureAt: r.departureAt,
        eventAt: r.eventAt,
        expectedReturnAt: r.expectedReturnAt,
        items,
        subtotalCents: items.reduce((s, i) => s + i.totalCents, 0),
        discountCents: r.discountCents,
        totalCents: r.totalCents,
        paymentTerms: r.paymentTerms ?? template.defaultPaymentTerms,
        billing: modalidade(r.billingMode, r.periodCount),
        notes: r.notes,
      }}
    />,
  );
  return { buffer, fileName: `orcamento-${String(r.number).padStart(6, "0")}.pdf` };
}

export async function saleReceiptPdf(saleId: string) {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { customer: true, items: { include: { product: true } }, payments: { orderBy: { paidAt: "asc" } } },
  });
  if (!sale) return null;
  const items = sale.items.map((i) => ({
    quantity: i.quantity,
    code: i.product.sku,
    name: i.product.name,
    unit: i.product.unit,
    unitPriceCents: i.unitPriceCents,
    totalCents: i.quantity * i.unitPriceCents,
  }));
  const buffer = await renderToBuffer(
    <SaleReceiptPdf
      r={{
        company: await company(),
        number: sale.number,
        soldAt: sale.soldAt,
        customerName: sale.customer?.name ?? sale.customerName ?? "Venda avulsa",
        customerDocument: sale.customer?.document ?? null,
        items,
        subtotalCents: items.reduce((s, i) => s + i.totalCents, 0),
        discountCents: sale.discountCents,
        totalCents: sale.totalCents,
        payments: sale.payments.map((p) => ({ method: PAYMENT_METHOD_LABEL[p.method], amountCents: p.amountCents, paidAt: p.paidAt })),
        notes: sale.notes,
        canceled: sale.status === "CANCELADA",
      }}
    />,
  );
  return { buffer, fileName: `venda-${String(sale.number).padStart(6, "0")}.pdf` };
}

export function pdfResponse(file: { buffer: Buffer; fileName: string }, download: boolean) {
  return new Response(new Uint8Array(file.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${file.fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
