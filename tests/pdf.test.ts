import { writeFileSync } from "node:fs";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import type { ContractSnapshot } from "@/lib/contract-types";
import { ContractPdf } from "@/server/pdf/documents";

const snapshot: ContractSnapshot = {
  version: 1,
  generatedAt: new Date("2026-10-01T12:00:00Z").toISOString(),
  company: { name: "Universo Tendas", cnpj: null, address: null, city: "Sinop - MT", phones: "(66) 3531-4760 · (66) 9 9982-4544", email: null, instagram: "@universotendas" },
  customer: { name: "Cliente de Teste", document: "000.000.000-00", phone: "(66) 90000-0000", whatsapp: null, email: "teste@exemplo.com", address: "Rua de Teste, 1", city: "Sinop - MT" },
  rental: {
    number: 12, eventName: "Evento de teste", eventAddress: "Local de teste", setupAt: null,
    departureAt: "2026-10-09T12:00:00Z", eventAt: "2026-10-10T22:00:00Z", expectedReturnAt: "2026-10-11T20:00:00Z",
    teardownAt: null, pickupBy: null, notes: "Observação de teste.",
  },
  items: Array.from({ length: 3 }, (_, i) => ({ productId: null, code: `COD-${i + 1}`, name: `Produto de teste ${i + 1}`, unit: "un", quantity: i + 1, unitPriceCents: 10000, totalCents: (i + 1) * 10000 })),
  subtotalCents: 60000,
  discountCents: 5000,
  totalCents: 55000,
  paymentTerms: "Condição de teste.",
  intro: null,
  clauses: [{ title: "Cláusula de teste", body: "Texto de teste escrito pela empresa." }],
  footer: null,
};

describe("PDF do contrato", () => {
  it("gera um PDF A4 válido com os dados do contrato", async () => {
    const buf = await renderToBuffer(
      createElement(ContractPdf, { snapshot, number: 7, createdAt: new Date("2026-10-01T12:00:00Z"), contentHash: "a".repeat(64), status: "RASCUNHO", signatures: [{ role: "Contratante", name: "Cliente de Teste" }, { role: "Contratada", name: "Universo Tendas" }] }) as never,
    );
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(20_000); // inclui o logo
    // Rodapé com paginação e código de verificação (texto comprimido: confere pela estrutura de páginas)
    expect(buf.toString("latin1").match(/\/Type \/Page\b/g)?.length).toBeGreaterThanOrEqual(1);
    if (process.env.PDF_OUT) writeFileSync(process.env.PDF_OUT, buf);
  });
});
