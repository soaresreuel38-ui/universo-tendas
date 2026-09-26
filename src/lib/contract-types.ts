/** Estrutura congelada de um contrato (guardada em Contract.snapshot). */
export type ContractSnapshot = {
  version: 1;
  generatedAt: string;
  company: {
    name: string;
    cnpj: string | null;
    address: string | null;
    city: string;
    phones: string;
    email: string | null;
    instagram: string;
  };
  customer: {
    name: string;
    document: string | null;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
  };
  rental: {
    number: number;
    eventName: string;
    eventAddress: string | null;
    setupAt: string | null;
    departureAt: string;
    eventAt: string | null;
    expectedReturnAt: string;
    teardownAt: string | null;
    pickupBy: string | null;
    notes: string | null;
  };
  items: Array<{
    productId: string | null;
    code: string;
    name: string;
    unit: string;
    quantity: number;
    unitPriceCents: number;
    totalCents: number;
  }>;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  paymentTerms: string | null;
  intro: string | null;
  clauses: Array<{ title: string; body: string }>;
  footer: string | null;
};

export type ClauseInput = { title: string; body: string };

/** Tópicos sugeridos pela empresa. O texto das cláusulas NÃO é preenchido pelo sistema. */
export const SUGGESTED_CLAUSE_TOPICS = [
  "Responsabilidade pelos equipamentos",
  "Condições de devolução",
  "Danos",
  "Perdas",
  "Atraso na devolução",
  "Cancelamento",
  "Prazo",
  "Pagamento",
  "Montagem e desmontagem",
];
