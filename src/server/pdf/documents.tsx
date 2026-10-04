import { Document, Text, View } from "@react-pdf/renderer";
import type { ContractSnapshot } from "@/lib/contract-types";
import { BILLING_LABEL, periodLabel } from "@/lib/billing";
import { fmtDate, fmtDateTime, money, seq } from "@/lib/format";
import { DocHeader, DocPage, Grid, s, Section, Signatures, Table, Totals, type Column, type Company, type SignatureView } from "./components";

const ITEM_COLUMNS: Column[] = [
  { title: "QTD.", width: "8%", align: "center" },
  { title: "CÓDIGO", width: "14%" },
  { title: "PRODUTO", width: "40%" },
  { title: "UN.", width: "8%", align: "center" },
  { title: "PREÇO UNIT.", width: "15%", align: "right" },
  { title: "TOTAL", width: "15%", align: "right" },
];

type Item = { quantity: number; code: string; name: string; unit: string; unitPriceCents: number; totalCents: number };

const itemRows = (items: Item[]) =>
  items.map((i) => [String(i.quantity), i.code, i.name, i.unit, money(i.unitPriceCents), money(i.totalCents)]);

const d = (iso: string | null) => (iso ? fmtDateTime(new Date(iso)) : null);

// ───────────────────────── Contrato ─────────────────────────

export function ContractPdf({
  snapshot,
  number,
  createdAt,
  contentHash,
  signatures,
  status,
}: {
  snapshot: ContractSnapshot;
  number: number;
  createdAt: Date;
  contentHash: string;
  signatures: SignatureView[];
  status: string;
}) {
  const c = snapshot;
  const ref = `Contrato ${seq(number)} · verificação ${contentHash.slice(0, 12).toUpperCase()}`;
  return (
    <Document title={`Contrato ${seq(number)} — ${c.customer.name}`} author={c.company.name} subject="Contrato de locação" language="pt-BR">
      <DocPage company={c.company} footerRef={ref}>
        <DocHeader company={c.company} docType="Contrato de locação" docNumber={`Nº ${seq(number)}`} docDate={`Emitido em ${fmtDate(createdAt)}`} />

        {status === "CANCELADO" ? <Text style={[s.sectionTitle, { color: "#c62b34", fontSize: 10 }]}>CONTRATO CANCELADO</Text> : null}

        <Section title="Identificação da operação">
          <Grid
            items={[
              ["Locação (referência)", `#${seq(c.rental.number)}`],
              ["Evento", c.rental.eventName],
            ]}
          />
        </Section>

        <Section title="Contratante">
          <Grid
            items={[
              ["Nome / razão social", c.customer.name, true],
              ["CPF / CNPJ", c.customer.document],
              ["Telefone", c.customer.phone],
              ["WhatsApp", c.customer.whatsapp],
              ["E-mail", c.customer.email],
              ["Endereço", [c.customer.address, c.customer.city].filter(Boolean).join(" · ") || null, true],
            ]}
          />
        </Section>

        <Section title="Evento e entrega">
          <Grid
            items={[
              ["Endereço de entrega / evento", c.rental.eventAddress, true],
              ["Modalidade", c.rental.billingMode ? `${BILLING_LABEL[c.rental.billingMode]} — ${periodLabel(c.rental.billingMode, c.rental.periodCount ?? 1)}` : null],
              ["Montagem", d(c.rental.setupAt)],
              ["Saída dos equipamentos", d(c.rental.departureAt)],
              ["Data do evento", d(c.rental.eventAt)],
              ["Retorno previsto", d(c.rental.expectedReturnAt)],
              ["Desmontagem", d(c.rental.teardownAt)],
              ["Responsável pela retirada", c.rental.pickupBy],
            ]}
          />
        </Section>

        <Text style={s.sectionTitle}>Produtos</Text>
        <Table columns={ITEM_COLUMNS} rows={itemRows(c.items)} />
        <Totals
          lines={[
            ["Subtotal", money(c.subtotalCents)],
            ...(c.discountCents ? ([["Desconto", `− ${money(c.discountCents)}`]] as Array<[string, string]>) : []),
          ]}
          total={money(c.totalCents)}
        />

        {c.paymentTerms ? (
          <Section title="Condição / prazo de pagamento">
            <Text style={s.paragraph}>{c.paymentTerms}</Text>
          </Section>
        ) : null}

        {c.rental.notes ? (
          <Section title="Observações">
            <Text style={s.paragraph}>{c.rental.notes}</Text>
          </Section>
        ) : null}

        {c.intro || c.clauses.length ? (
          <View>
            <Text style={s.sectionTitle}>Cláusulas e condições</Text>
            {c.intro ? <Text style={s.paragraph}>{c.intro}</Text> : null}
            {c.clauses.map((cl, i) => (
              <View key={i} wrap={false}>
                <Text style={s.clauseTitle}>
                  Cláusula {i + 1}ª — {cl.title}
                </Text>
                {cl.body.split(/\n{2,}/).map((para, j) => (
                  <Text key={j} style={s.paragraph}>
                    {para}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        <Signatures place={`${c.company.city}, ${fmtDate(createdAt)}.`} parties={signatures} />

        {c.footer ? <Text style={s.notice}>{c.footer}</Text> : null}
      </DocPage>
    </Document>
  );
}

// ───────────────────────── Orçamento ─────────────────────────

export type QuoteData = {
  company: Company;
  number: number;
  createdAt: Date;
  customer: ContractSnapshot["customer"];
  eventName: string;
  eventAddress: string | null;
  departureAt: Date;
  eventAt: Date | null;
  expectedReturnAt: Date;
  items: Item[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  paymentTerms: string | null;
  notes: string | null;
  /** Ex.: "Locação diária — 3 diárias". */
  billing?: string | null;
};

export function QuotePdf({ q }: { q: QuoteData }) {
  return (
    <Document title={`Orçamento ${seq(q.number)} — ${q.customer.name}`} author={q.company.name} language="pt-BR">
      <DocPage company={q.company} footerRef={`Orçamento ${seq(q.number)}`}>
        <DocHeader company={q.company} docType="Orçamento de locação" docNumber={`Nº ${seq(q.number)}`} docDate={`Emitido em ${fmtDate(new Date())}`} />
        <Section title="Cliente">
          <Grid
            items={[
              ["Nome / razão social", q.customer.name, true],
              ["CPF / CNPJ", q.customer.document],
              ["Telefone", q.customer.phone ?? q.customer.whatsapp],
              ["E-mail", q.customer.email],
              ["Endereço", [q.customer.address, q.customer.city].filter(Boolean).join(" · ") || null, true],
            ]}
          />
        </Section>
        <Section title="Evento">
          <Grid
            items={[
              ["Evento", q.eventName],
              ["Modalidade", q.billing ?? null],
              ["Data do evento", q.eventAt ? fmtDateTime(q.eventAt) : null],
              ["Local", q.eventAddress, true],
              ["Saída", fmtDateTime(q.departureAt)],
              ["Retorno previsto", fmtDateTime(q.expectedReturnAt)],
            ]}
          />
        </Section>
        <Text style={s.sectionTitle}>Produtos</Text>
        <Table columns={ITEM_COLUMNS} rows={itemRows(q.items)} />
        <Totals
          lines={[
            ["Subtotal", money(q.subtotalCents)],
            ...(q.discountCents ? ([["Desconto", `− ${money(q.discountCents)}`]] as Array<[string, string]>) : []),
          ]}
          total={money(q.totalCents)}
        />
        {q.paymentTerms ? (
          <Section title="Condição / prazo de pagamento">
            <Text style={s.paragraph}>{q.paymentTerms}</Text>
          </Section>
        ) : null}
        {q.notes ? (
          <Section title="Observações">
            <Text style={s.paragraph}>{q.notes}</Text>
          </Section>
        ) : null}
        <Text style={s.notice}>Disponibilidade dos produtos sujeita à confirmação da reserva.</Text>
      </DocPage>
    </Document>
  );
}

// ───────────────────────── Comprovante de venda ─────────────────────────

export type SaleReceiptData = {
  company: Company;
  number: number;
  soldAt: Date;
  customerName: string;
  customerDocument: string | null;
  items: Item[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  payments: Array<{ method: string; amountCents: number; paidAt: Date }>;
  notes: string | null;
  canceled: boolean;
};

export function SaleReceiptPdf({ r }: { r: SaleReceiptData }) {
  return (
    <Document title={`Venda ${seq(r.number)}`} author={r.company.name} language="pt-BR">
      <DocPage company={r.company} footerRef={`Comprovante de venda ${seq(r.number)}`}>
        <DocHeader company={r.company} docType="Comprovante de venda" docNumber={`Nº ${seq(r.number)}`} docDate={fmtDateTime(r.soldAt)} />
        {r.canceled ? <Text style={[s.sectionTitle, { color: "#c62b34", fontSize: 10 }]}>VENDA CANCELADA</Text> : null}
        <Section title="Cliente">
          <Grid items={[["Nome", r.customerName, true], ["CPF / CNPJ", r.customerDocument]]} />
        </Section>
        <Text style={s.sectionTitle}>Produtos</Text>
        <Table columns={ITEM_COLUMNS} rows={itemRows(r.items)} />
        <Totals
          lines={[
            ["Subtotal", money(r.subtotalCents)],
            ...(r.discountCents ? ([["Desconto", `− ${money(r.discountCents)}`]] as Array<[string, string]>) : []),
          ]}
          total={money(r.totalCents)}
        />
        {r.payments.length ? (
          <Section title="Pagamento">
            {r.payments.map((p, i) => (
              <Text key={i} style={s.paragraph}>
                {p.method} — {money(p.amountCents)} em {fmtDateTime(p.paidAt)}
              </Text>
            ))}
          </Section>
        ) : null}
        {r.notes ? (
          <Section title="Observações">
            <Text style={s.paragraph}>{r.notes}</Text>
          </Section>
        ) : null}
      </DocPage>
    </Document>
  );
}
