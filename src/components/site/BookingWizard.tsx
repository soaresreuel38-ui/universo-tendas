"use client";

/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ProductPlaceholder } from "@/components/products/ProductImage";
import { track } from "@/lib/analytics";
import { checkEventDates, eventDays } from "@/lib/booking";
import { formatCep, isValidCnpj, isValidCpf, normalizePhone, UF_LIST } from "@/lib/br-documents";
import { fmtDate, money, onlyDigits } from "@/lib/format";
import { publicPhotoUrl } from "@/lib/public-urls";
import { addDays, startOfDay, todayKey } from "@/lib/time";

export type WizardProduct = {
  id: string;
  slug: string;
  name: string;
  code: string;
  category: string;
  dimensions: string | null;
  unit: string;
  rentalPriceCents: number | null;
  photoId: string | null;
};

type Address = { zipCode: string; street: string; number: string; complement: string; district: string; city: string; state: string; notes: string };
type Customer = { personType: "PF" | "PJ"; name: string; tradeName: string; contactName: string; document: string; whatsapp: string; email: string };

type Draft = {
  productId: string | null;
  start: string;
  end: string;
  startTime: string;
  endTime: string;
  eventName: string;
  address: Address;
  quantity: number;
  customer: Customer;
};

const STEPS = ["Tenda", "Data", "Local", "Quantidade", "Seus dados", "Revisão"] as const;
const DRAFT_KEY = "ut-reserva-rascunho";

const emptyAddress: Address = { zipCode: "", street: "", number: "", complement: "", district: "", city: "", state: "MT", notes: "" };
const emptyCustomer: Customer = { personType: "PF", name: "", tradeName: "", contactName: "", document: "", whatsapp: "", email: "" };

/** Rascunho guardado só nesta aba (sem CPF/CNPJ), para não perder o que foi digitado ao recarregar. */
function loadDraft(): Partial<Draft> | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Partial<Draft>) : null;
  } catch {
    return null;
  }
}
function saveDraft(d: Draft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...d, customer: { ...d.customer, document: "" } }));
  } catch {
    // armazenamento indisponível: segue sem rascunho
  }
}
function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

export function BookingWizard({
  products,
  initialProductId,
  initialStart,
  initialEnd,
  companyWhatsapp,
  daysBefore,
  daysAfter,
}: {
  products: WizardProduct[];
  initialProductId: string | null;
  initialStart: string;
  initialEnd: string;
  companyWhatsapp: string | null;
  daysBefore: number;
  daysAfter: number;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>({
    productId: initialProductId,
    start: initialStart,
    end: initialEnd,
    startTime: "",
    endTime: "",
    eventName: "",
    address: emptyAddress,
    quantity: 1,
    customer: emptyCustomer,
  });
  const [step, setStep] = useState(initialProductId ? 1 : 0);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<{ key: string; free: number; loading: boolean; error: string | null } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const done = useRef(false);
  const top = useRef<HTMLDivElement>(null);

  // Recupera o rascunho desta aba (sem sobrescrever o que veio pela URL).
  useEffect(() => {
    const saved = loadDraft();
    // Aplicado depois da hidratação (o servidor não tem acesso ao rascunho desta aba).
    if (saved) {
      queueMicrotask(() =>
        setDraft((d) => ({
          ...d,
          ...saved,
          productId: initialProductId ?? saved.productId ?? null,
          start: initialStart || saved.start || "",
          end: initialEnd || saved.end || "",
          address: { ...emptyAddress, ...saved.address },
          customer: { ...emptyCustomer, ...saved.customer, document: "" },
        })),
      );
    }
    track("booking_start", { product: initialProductId ?? "" });
  }, [initialProductId, initialStart, initialEnd]);

  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  // Abandono: registra em que etapa a pessoa saiu (sem dados pessoais).
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  useEffect(() => {
    const onHide = () => {
      if (!done.current) track("booking_abandon", { step: STEPS[stepRef.current] });
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  const product = products.find((p) => p.id === draft.productId) ?? null;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setAddr = (k: keyof Address, v: string) => setDraft((d) => ({ ...d, address: { ...d.address, [k]: v } }));
  const setCust = (k: keyof Customer, v: string) => setDraft((d) => ({ ...d, customer: { ...d.customer, [k]: v } }));

  // ── Disponibilidade (sempre do servidor; recalculada quando tenda ou datas mudam) ──
  const availKey = product && draft.start && draft.end ? `${product.id}|${draft.start}|${draft.end}` : "";
  const loadAvailability = useCallback(async () => {
    if (!product || !availKey) return null;
    setAvailability({ key: availKey, free: 0, loading: true, error: null });
    try {
      const res = await fetch(`/api/public/availability?ids=${product.id}&inicio=${draft.start}&fim=${draft.end}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível consultar a disponibilidade.");
      const free = Number(data.free?.[product.id] ?? 0);
      setAvailability({ key: availKey, free, loading: false, error: null });
      // O período mudou e agora há menos unidades: ajusta a quantidade escolhida.
      setDraft((d) => (free > 0 && d.quantity > free ? { ...d, quantity: free } : d));
      track("availability_check", { product: product.slug, free });
      return free;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Não foi possível consultar a disponibilidade.";
      setAvailability({ key: availKey, free: 0, loading: false, error: msg });
      return null;
    }
  }, [product, availKey, draft.start, draft.end]);

  useEffect(() => {
    if (availKey && availability?.key !== availKey && step >= 1) {
      const id = setTimeout(() => void loadAvailability(), 250);
      return () => clearTimeout(id);
    }
  }, [availKey, availability?.key, loadAvailability, step]);

  const free = availability && availability.key === availKey && !availability.loading ? availability.free : null;

  // ── Validação de cada etapa (o servidor valida tudo de novo) ──
  const dateError = draft.start || draft.end ? checkEventDates(draft.start, draft.end, { startTime: draft.startTime || null, endTime: draft.endTime || null }) : "Informe as datas do evento.";
  function validate(s: number): string | null {
    if (s === 0) return product ? null : "Escolha uma tenda.";
    if (s === 1) return dateError;
    if (s === 2) {
      const a = draft.address;
      if (onlyDigits(a.zipCode).length !== 8) return "Informe um CEP válido.";
      if (!a.street.trim()) return "Informe o endereço.";
      if (!a.number.trim()) return "Informe o número (ou S/N).";
      if (!a.district.trim()) return "Informe o bairro.";
      if (!a.city.trim()) return "Informe a cidade.";
      return null;
    }
    if (s === 3) {
      if (free == null) return availability?.error ?? "Aguarde a consulta de disponibilidade.";
      if (free <= 0) return "Não há estoque suficiente para o período selecionado.";
      if (draft.quantity < 1 || draft.quantity > free) return "Não há estoque suficiente para o período selecionado.";
      return null;
    }
    if (s === 4) {
      const c = draft.customer;
      if (!c.name.trim()) return c.personType === "PF" ? "Informe seu nome completo." : "Informe a razão social.";
      if (c.personType === "PF" && !isValidCpf(c.document)) return "CPF inválido.";
      if (c.personType === "PJ" && !isValidCnpj(c.document)) return "CNPJ inválido.";
      if (c.personType === "PJ" && !c.contactName.trim()) return "Informe o nome do responsável.";
      if (!normalizePhone(c.whatsapp)) return "WhatsApp inválido. Use DDD + número.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim())) return "E-mail inválido.";
      return null;
    }
    return null;
  }

  function goTo(s: number) {
    setError(null);
    setStep(s);
    track("booking_step", { step: STEPS[s] });
    requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  function next() {
    const err = validate(step);
    if (err) {
      setError(err);
      return;
    }
    goTo(Math.min(step + 1, STEPS.length - 1));
  }

  async function submit() {
    for (let s = 0; s < 5; s++) {
      const err = validate(s);
      if (err) {
        goTo(s);
        setError(err);
        return;
      }
    }
    setSubmitting(true);
    setError(null);
    try {
      const c = draft.customer;
      const res = await fetch("/api/public/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ productId: product!.id, quantity: draft.quantity }],
          eventStart: draft.start,
          eventEnd: draft.end,
          startTime: draft.startTime || null,
          endTime: draft.endTime || null,
          eventName: draft.eventName,
          address: draft.address,
          customer:
            c.personType === "PF"
              ? { personType: "PF", name: c.name, document: c.document, whatsapp: c.whatsapp, email: c.email }
              : { personType: "PJ", name: c.name, tradeName: c.tradeName, contactName: c.contactName, document: c.document, whatsapp: c.whatsapp, email: c.email },
          website: (document.getElementById("ut-website") as HTMLInputElement | null)?.value ?? "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        track("booking_error", { status: res.status });
        // Estoque mudou enquanto a pessoa preenchia: volta para a quantidade com o número atualizado.
        if (res.status === 409 && /estoque/i.test(String(data.error))) {
          await loadAvailability();
          goTo(3);
        }
        setError(data.error ?? "Não foi possível concluir agora. Tente novamente.");
        setSubmitting(false);
        return;
      }
      done.current = true;
      clearDraft();
      track("booking_complete", { product: product!.slug, quantity: draft.quantity });
      router.push(`/minha-reserva/${data.token}?nova=1`);
    } catch {
      setError("Sem conexão. Verifique a internet e tente novamente.");
      setSubmitting(false);
    }
  }

  const blocked = useMemo(() => {
    if (!draft.start || !draft.end || dateError) return null;
    return { from: addDays(draft.start, -daysBefore), to: addDays(draft.end, daysAfter) };
  }, [draft.start, draft.end, dateError, daysBefore, daysAfter]);

  const days = draft.start && draft.end && !dateError ? eventDays(draft.start, draft.end) : 1;
  // Mesma regra do painel: diária × dias do evento × unidades (a margem operacional não é cobrada).
  const total = product?.rentalPriceCents != null ? product.rentalPriceCents * days * draft.quantity : null;
  const isLast = step === STEPS.length - 1;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-40 pt-8 sm:px-6 sm:pt-12" ref={top}>
      {/* Progresso */}
      <div className="scroll-mt-24">
        <div className="flex items-baseline justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-night/45">
            Etapa {step + 1} de {STEPS.length}
          </p>
          {step > 0 ? (
            <button type="button" onClick={() => goTo(step - 1)} className="text-[13px] text-night/60 underline-offset-4 hover:underline">
              ← Voltar
            </button>
          ) : null}
        </div>
        <div className="mt-3 grid grid-cols-6 gap-1.5" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s} className={`h-[3px] rounded-full transition-colors duration-500 ${i <= step ? "bg-night" : "bg-night/10"}`} />
          ))}
        </div>
      </div>

      {/* Tenda escolhida (resumo fixo a partir da etapa 2) */}
      {product && step > 0 ? (
        <button type="button" onClick={() => goTo(0)} className="mt-6 flex w-full items-center gap-4 rounded-[4px] bg-white p-3 text-left ring-1 ring-night/10 hover:ring-night/30">
          <span className="h-14 w-16 shrink-0 overflow-hidden rounded-[3px]">
            {product.photoId ? <img src={publicPhotoUrl(product.photoId, true)} alt="" className="h-full w-full object-cover" /> : <ProductPlaceholder compact />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium">{product.name}</span>
            <span className="block text-[13px] text-night/55">
              {draft.start && draft.end && !dateError ? `${fmtDate(startOfDay(draft.start))} → ${fmtDate(startOfDay(draft.end))}` : product.category}
              {step > 3 ? ` · ${draft.quantity} ${draft.quantity === 1 ? "unidade" : "unidades"}` : ""}
            </span>
          </span>
          <span className="text-[12px] text-night/50">Trocar</span>
        </button>
      ) : null}

      <section className="mt-8 animate-rise" key={step} aria-live="polite">
        {step === 0 ? (
          <Step title="Escolha a tenda">
            <ul className="space-y-3">
              {products.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      set("productId", p.id);
                      setError(null);
                      goTo(1);
                    }}
                    className={`flex w-full items-center gap-4 rounded-[4px] bg-white p-3 text-left ring-1 transition ${
                      p.id === draft.productId ? "ring-2 ring-night" : "ring-night/10 hover:ring-night/30"
                    }`}
                    aria-pressed={p.id === draft.productId}
                  >
                    <span className="h-20 w-24 shrink-0 overflow-hidden rounded-[3px]">
                      {p.photoId ? <img src={publicPhotoUrl(p.photoId, true)} alt="" loading="lazy" className="h-full w-full object-cover" /> : <ProductPlaceholder compact />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-night/45">{p.category}</span>
                      <span className="mt-1 block font-display text-[20px] font-light leading-tight">{p.name}</span>
                      <span className="mt-1 block text-[13px] text-night/60">
                        {p.dimensions ? `${p.dimensions} · ` : ""}
                        {p.rentalPriceCents != null ? `${money(p.rentalPriceCents)} / dia` : "Valor a consultar"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Step>
        ) : null}

        {step === 1 ? (
          <Step title="Quando é o evento?" lead="Informe o primeiro e o último dia do evento.">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Início do evento"
                type="date"
                value={draft.start}
                min={todayKey()}
                onChange={(v) => setDraft((d) => ({ ...d, start: v, end: d.end && d.end >= v ? d.end : v }))}
              />
              <Input label="Término do evento" type="date" value={draft.end} min={draft.start || todayKey()} onChange={(v) => set("end", v)} />
            </div>
            <details className="mt-4 group" open={Boolean(draft.startTime || draft.endTime)}>
              <summary className="cursor-pointer list-none text-[14px] text-night/65 underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
                + Adicionar horários (opcional)
              </summary>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Input label="Horário de início" type="time" value={draft.startTime} onChange={(v) => set("startTime", v)} />
                <Input label="Horário de término" type="time" value={draft.endTime} onChange={(v) => set("endTime", v)} />
              </div>
            </details>
            <div className="mt-4">
              <Input label="Nome ou tipo do evento (opcional)" value={draft.eventName} onChange={(v) => set("eventName", v)} maxLength={120} placeholder="Ex.: Casamento, feira, aniversário" />
            </div>
            {blocked ? (
              <div className="mt-6 rounded-[4px] bg-white p-4 text-[14px] leading-relaxed text-night/70 ring-1 ring-night/10">
                {daysBefore || daysAfter ? (
                  <>
                    Para montagem e retirada, as unidades ficam reservadas de <b className="text-night">{fmtDate(startOfDay(blocked.from))}</b> a{" "}
                    <b className="text-night">{fmtDate(startOfDay(blocked.to))}</b>.
                  </>
                ) : (
                  <>As unidades ficam reservadas de {fmtDate(startOfDay(blocked.from))} a {fmtDate(startOfDay(blocked.to))}.</>
                )}
                <AvailabilityLine free={free} loading={availability?.loading ?? false} error={availability?.error ?? null} unit={product?.unit ?? "un"} />
              </div>
            ) : null}
          </Step>
        ) : null}

        {step === 2 ? (
          <Step title="Onde será o evento?" lead="O endereço fica vinculado à reserva.">
            <AddressFields address={draft.address} setAddr={setAddr} />
          </Step>
        ) : null}

        {step === 3 && product ? (
          <Step title="Quantas unidades?">
            {free == null ? (
              <p className="text-night/60">{availability?.error ?? "Consultando disponibilidade…"}</p>
            ) : free <= 0 ? (
              <div className="rounded-[4px] bg-white p-5 ring-1 ring-accent/30">
                <p className="text-[16px] text-accent">Não há estoque suficiente para o período selecionado.</p>
                <button type="button" onClick={() => goTo(1)} className="mt-4 h-12 rounded-full border border-night/20 px-5 text-[12px] font-semibold uppercase tracking-[0.14em]">
                  Escolher outra data
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center gap-6 rounded-[4px] bg-white py-8 ring-1 ring-night/10">
                  <StepperButton label="Diminuir" disabled={draft.quantity <= 1} onClick={() => set("quantity", Math.max(1, draft.quantity - 1))}>−</StepperButton>
                  <input
                    aria-label="Quantidade"
                    inputMode="numeric"
                    value={draft.quantity}
                    onChange={(e) => {
                      const n = Number(onlyDigits(e.target.value)) || 1;
                      set("quantity", Math.min(Math.max(1, n), free));
                    }}
                    className="w-24 bg-transparent text-center font-display text-[56px] font-light tabular outline-none"
                  />
                  <StepperButton label="Aumentar" disabled={draft.quantity >= free} onClick={() => set("quantity", Math.min(free, draft.quantity + 1))}>+</StepperButton>
                </div>
                <dl className="mt-5 grid grid-cols-3 divide-x divide-night/10 rounded-[4px] bg-white text-center ring-1 ring-night/10">
                  <Stat label="Disponível para o período" value={free} />
                  <Stat label="Selecionado" value={draft.quantity} />
                  <Stat label="Disponível após a reserva" value={free - draft.quantity} />
                </dl>
                <p className="mt-3 text-[13px] text-night/50">Números consultados agora no nosso estoque. Na confirmação, conferimos de novo.</p>
              </>
            )}
          </Step>
        ) : null}

        {step === 4 ? (
          <Step title="Seus dados" lead="Só o necessário para registrar a locação.">
            <div className="mb-5 grid grid-cols-2 rounded-full bg-white p-1 ring-1 ring-night/10" role="radiogroup" aria-label="Tipo de cliente">
              {(["PF", "PJ"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={draft.customer.personType === t}
                  onClick={() => setCust("personType", t)}
                  className={`h-11 rounded-full text-[14px] transition ${draft.customer.personType === t ? "bg-night text-white" : "text-night/65"}`}
                >
                  {t === "PF" ? "Pessoa física" : "Pessoa jurídica"}
                </button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {draft.customer.personType === "PF" ? (
                <>
                  <Input className="sm:col-span-2" label="Nome completo" value={draft.customer.name} onChange={(v) => setCust("name", v)} autoComplete="name" maxLength={120} />
                  <Input label="CPF" value={draft.customer.document} onChange={(v) => setCust("document", v)} inputMode="numeric" maxLength={14} placeholder="000.000.000-00" />
                </>
              ) : (
                <>
                  <Input className="sm:col-span-2" label="Razão social" value={draft.customer.name} onChange={(v) => setCust("name", v)} autoComplete="organization" maxLength={160} />
                  <Input label="Nome fantasia (opcional)" value={draft.customer.tradeName} onChange={(v) => setCust("tradeName", v)} maxLength={160} />
                  <Input label="CNPJ" value={draft.customer.document} onChange={(v) => setCust("document", v)} inputMode="numeric" maxLength={18} placeholder="00.000.000/0000-00" />
                  <Input label="Responsável" value={draft.customer.contactName} onChange={(v) => setCust("contactName", v)} autoComplete="name" maxLength={120} />
                </>
              )}
              <Input label="WhatsApp" type="tel" value={draft.customer.whatsapp} onChange={(v) => setCust("whatsapp", v)} autoComplete="tel-national" inputMode="tel" placeholder="(66) 90000-0000" maxLength={20} />
              <Input className="sm:col-span-2" label="E-mail" type="email" value={draft.customer.email} onChange={(v) => setCust("email", v)} autoComplete="email" maxLength={160} />
            </div>
            {/* armadilha para robôs: invisível para pessoas */}
            <input id="ut-website" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
          </Step>
        ) : null}

        {step === 5 && product ? (
          <Step title="Minha reserva" lead="Confira antes de confirmar.">
            <div className="divide-y divide-night/10 rounded-[4px] bg-white ring-1 ring-night/10">
              <Row label="Tenda" onEdit={() => goTo(0)}>
                {product.name} <span className="text-night/50">· {product.code}</span>
              </Row>
              <Row label="Quantidade" onEdit={() => goTo(3)}>{draft.quantity} {draft.quantity === 1 ? "unidade" : "unidades"}</Row>
              <Row label="Evento" onEdit={() => goTo(1)}>
                {fmtDate(startOfDay(draft.start))} → {fmtDate(startOfDay(draft.end))}
                {draft.startTime || draft.endTime ? <span className="text-night/55"> · {draft.startTime || "--:--"} às {draft.endTime || "--:--"}</span> : null}
                {draft.eventName ? <span className="block text-night/55">{draft.eventName}</span> : null}
              </Row>
              <Row label="Local" onEdit={() => goTo(2)}>
                {draft.address.street}, {draft.address.number}
                {draft.address.complement ? ` — ${draft.address.complement}` : ""}
                <span className="block text-night/55">
                  {draft.address.district}, {draft.address.city}/{draft.address.state} · CEP {formatCep(draft.address.zipCode)}
                </span>
                {draft.address.notes ? <span className="block text-night/55">Obs.: {draft.address.notes}</span> : null}
              </Row>
              <Row label="Cliente" onEdit={() => goTo(4)}>
                {draft.customer.name}
                <span className="block text-night/55">{draft.customer.whatsapp} · {draft.customer.email}</span>
              </Row>
              <Row label="Valor">
                {product.rentalPriceCents != null
                  ? `${money(product.rentalPriceCents)} / dia × ${days} ${days === 1 ? "dia" : "dias"} × ${draft.quantity} ${draft.quantity === 1 ? "unidade" : "unidades"}`
                  : "Valor a consultar"}
              </Row>
              <div className="flex items-baseline justify-between px-5 py-5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-night/55">Total</span>
                <span className="font-display text-[30px] font-light">{total != null ? money(total) : "Valor a consultar"}</span>
              </div>
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-night/55">
              Ao confirmar, a reserva é registrada no nosso sistema e as unidades ficam separadas para o período enquanto a equipe analisa o pedido.
              {total == null ? " O valor será informado pela equipe." : ""} Taxas de entrega, quando houver, são combinadas com a equipe.
            </p>
          </Step>
        ) : null}

        {error ? (
          <p role="alert" className="mt-5 rounded-[4px] bg-accent-soft px-4 py-3 text-[15px] text-accent">
            {error}
          </p>
        ) : null}
      </section>

      {/* Barra de ação fixa (polegar no celular) */}
      {step > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-night/10 bg-linen/95 backdrop-blur pb-safe">
          <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3 sm:px-6">
            <div className="min-w-0 flex-1 text-[13px] leading-tight text-night/60">
              {isLast ? (
                <span className="block font-display text-[20px] text-night">{total != null ? money(total) : "Valor a consultar"}</span>
              ) : (
                <span className="block truncate">{STEPS[step]}</span>
              )}
            </div>
            {isLast ? (
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="h-14 flex-[2] rounded-full bg-night px-6 text-[13px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-night-soft disabled:opacity-60"
              >
                {submitting ? "Registrando…" : "Confirmar reserva"}
              </button>
            ) : (
              <button
                type="button"
                onClick={next}
                className="h-14 flex-[2] rounded-full bg-night px-6 text-[13px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-night-soft"
              >
                Continuar
              </button>
            )}
          </div>
        </div>
      ) : null}

      {companyWhatsapp ? (
        <p className="mt-10 text-center text-[13px] text-night/50">
          Prefere falar com alguém?{" "}
          <a href={`https://wa.me/${companyWhatsapp}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4" onClick={() => track("whatsapp_click", { from: "wizard" })}>
            Chame no WhatsApp
          </a>
        </p>
      ) : null}
    </main>
  );
}

// ───────────────────────── Partes ─────────────────────────

function Step({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <div>
      <h1 className="font-display text-[34px] font-light leading-[1.08] tracking-[-0.02em] sm:text-[42px]">{title}</h1>
      {lead ? <p className="mt-2 text-[16px] text-night/60">{lead}</p> : null}
      <div className="mt-7">{children}</div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  className = "",
  ...rest
}: { label: string; value: string; onChange: (v: string) => void; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[13px] font-medium text-night/65">{label}</span>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 h-12 w-full rounded-lg border border-night/15 bg-white px-3.5 text-[16px] text-night outline-none transition focus:border-night focus:ring-2 focus:ring-night/10"
      />
    </label>
  );
}

function AvailabilityLine({ free, loading, error, unit }: { free: number | null; loading: boolean; error: string | null; unit: string }) {
  if (loading) return <span className="mt-2 block text-night/50">Consultando disponibilidade…</span>;
  if (error) return <span className="mt-2 block text-accent">{error}</span>;
  if (free == null) return null;
  return free > 0 ? (
    <span className="mt-2 block text-night">
      <b className="font-semibold">{free}</b> {free === 1 ? (unit === "un" ? "unidade disponível" : unit) : unit === "un" ? "unidades disponíveis" : unit} para o período.
    </span>
  ) : (
    <span className="mt-2 block text-accent">Não há estoque suficiente para o período selecionado.</span>
  );
}

function StepperButton({ children, label, disabled, onClick }: { children: ReactNode; label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-14 w-14 items-center justify-center rounded-full text-[26px] ring-1 ring-night/20 transition hover:ring-night disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-2 py-4">
      <dd className="font-display text-[28px] font-light tabular">{value}</dd>
      <dt className="mt-1 text-[11px] leading-tight text-night/55">{label}</dt>
    </div>
  );
}

function Row({ label, onEdit, children }: { label: string; onEdit?: () => void; children: ReactNode }) {
  return (
    <div className="flex gap-4 px-5 py-4">
      <span className="w-24 shrink-0 pt-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-night/45">{label}</span>
      <span className="min-w-0 flex-1 text-[15px] leading-relaxed">{children}</span>
      {onEdit ? (
        <button type="button" onClick={onEdit} className="shrink-0 self-start text-[13px] text-night/55 underline-offset-4 hover:underline">
          Alterar
        </button>
      ) : null}
    </div>
  );
}

function AddressFields({ address, setAddr }: { address: Address; setAddr: (k: keyof Address, v: string) => void }) {
  const [cepState, setCepState] = useState<"idle" | "loading" | "notfound">("idle");
  const [showMap, setShowMap] = useState(false);

  // Preenche rua/bairro/cidade/UF pelo CEP (ViaCEP). Só o CEP sai do navegador.
  async function lookup(cep: string) {
    const d = onlyDigits(cep);
    if (d.length !== 8) return;
    setCepState("loading");
    try {
      const res = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const data = await res.json();
      if (data.erro) {
        setCepState("notfound");
        return;
      }
      if (data.logradouro) setAddr("street", data.logradouro);
      if (data.bairro) setAddr("district", data.bairro);
      if (data.localidade) setAddr("city", data.localidade);
      if (data.uf) setAddr("state", data.uf);
      setCepState("idle");
    } catch {
      setCepState("idle"); // sem consulta: a pessoa preenche manualmente
    }
  }

  const full = [address.street && `${address.street}, ${address.number}`, address.district, address.city && `${address.city} - ${address.state}`, formatCep(address.zipCode)]
    .filter(Boolean)
    .join(", ");
  const canMap = Boolean(address.street && address.city);

  return (
    <div className="grid gap-4 sm:grid-cols-6">
      <label className="block sm:col-span-2">
        <span className="text-[13px] font-medium text-night/65">CEP</span>
        <input
          value={address.zipCode}
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={9}
          placeholder="00000-000"
          onChange={(e) => {
            const v = e.target.value;
            setAddr("zipCode", v);
            if (onlyDigits(v).length === 8) void lookup(v);
          }}
          className="mt-1.5 h-12 w-full rounded-lg border border-night/15 bg-white px-3.5 text-[16px] outline-none focus:border-night focus:ring-2 focus:ring-night/10"
        />
        <span className="mt-1 block min-h-4 text-[12px] text-night/50">
          {cepState === "loading" ? "Buscando endereço…" : cepState === "notfound" ? "CEP não encontrado — preencha manualmente." : ""}
        </span>
      </label>
      <Input className="sm:col-span-4" label="Endereço" value={address.street} onChange={(v) => setAddr("street", v)} autoComplete="address-line1" maxLength={200} />
      <Input className="sm:col-span-2" label="Número" value={address.number} onChange={(v) => setAddr("number", v)} maxLength={20} placeholder="ou S/N" />
      <Input className="sm:col-span-4" label="Complemento (opcional)" value={address.complement} onChange={(v) => setAddr("complement", v)} autoComplete="address-line2" maxLength={120} />
      <Input className="sm:col-span-3" label="Bairro" value={address.district} onChange={(v) => setAddr("district", v)} maxLength={120} />
      <Input className="sm:col-span-2" label="Cidade" value={address.city} onChange={(v) => setAddr("city", v)} autoComplete="address-level2" maxLength={120} />
      <label className="block sm:col-span-1">
        <span className="text-[13px] font-medium text-night/65">UF</span>
        <select value={address.state} onChange={(e) => setAddr("state", e.target.value)} className="mt-1.5 h-12 w-full rounded-lg border border-night/15 bg-white px-2 text-[16px]">
          {UF_LIST.map((uf) => (
            <option key={uf} value={uf}>{uf}</option>
          ))}
        </select>
      </label>
      <label className="block sm:col-span-6">
        <span className="text-[13px] font-medium text-night/65">Observações sobre o local (opcional)</span>
        <textarea
          value={address.notes}
          onChange={(e) => setAddr("notes", e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="Ex.: entrada lateral, necessário montar no sábado, local possui escada"
          className="mt-1.5 w-full rounded-lg border border-night/15 bg-white px-3.5 py-3 text-[16px] outline-none focus:border-night focus:ring-2 focus:ring-night/10"
        />
      </label>
      {canMap ? (
        <div className="sm:col-span-6">
          {showMap ? (
            <iframe
              title="Local do evento no mapa"
              src={`https://www.google.com/maps?q=${encodeURIComponent(full)}&output=embed`}
              className="h-64 w-full rounded-[4px] border-0"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <button type="button" onClick={() => setShowMap(true)} className="text-[14px] text-night/65 underline underline-offset-4">
              Ver o endereço no mapa
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
