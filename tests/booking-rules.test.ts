import { describe, expect, it } from "vitest";
import { bookingWindow, checkEventDates, publicStatus } from "@/lib/booking";
import { isValidCnpj, isValidCpf, normalizePhone } from "@/lib/br-documents";
import { addDays, startOfDay, todayKey } from "@/lib/time";

/** Regras do site que não dependem do banco. */

const day = (offset: number) => addDays(todayKey(), offset);

describe("período operacional da reserva online", () => {
  it("evento 10→12 com margem 1/1 ocupa de 09 a 13 inteiros", () => {
    const w = bookingWindow("2026-10-10", "2026-10-12", 1, 1);
    expect(w.departureAt).toEqual(startOfDay("2026-10-09"));
    expect(w.expectedReturnAt).toEqual(startOfDay("2026-10-14")); // exclusivo: o dia 13 inteiro fica incluído
  });

  it("sem margem ocupa só os dias do evento", () => {
    const w = bookingWindow("2026-10-10", "2026-10-10", 0, 0);
    expect(w.departureAt).toEqual(startOfDay("2026-10-10"));
    expect(w.expectedReturnAt).toEqual(startOfDay("2026-10-11"));
  });
});

describe("validações", () => {
  it("CPF e CNPJ pelos dígitos verificadores", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-80")).toBe(false);
    expect(isValidCnpj("11.111.111/1111-11")).toBe(false);
  });

  it("telefone com DDD", () => {
    expect(normalizePhone("(66) 99999-1111")).toBe("66999991111");
    expect(normalizePhone("+55 66 3531-4760")).toBe("6635314760");
    expect(normalizePhone("99999")).toBeNull();
  });

  it("datas do evento", () => {
    expect(checkEventDates(day(-1), day(1))).toMatch(/já passou/);
    expect(checkEventDates(day(5), day(4))).toMatch(/término/);
    expect(checkEventDates(day(5), day(5), { startTime: "18:00", endTime: "10:00" })).toMatch(/horário/);
    expect(checkEventDates(day(5), day(6))).toBeNull();
  });
});

describe("status mostrado ao cliente", () => {
  it("reserva do site aguardando aprovação e pedido de cancelamento", () => {
    expect(publicStatus({ status: "RESERVADA" }).label).toBe("Reservada · aguardando aprovação");
    expect(publicStatus({ status: "CONFIRMADA", cancelRequestedAt: new Date() }).label).toBe("Cancelamento solicitado");
    expect(publicStatus({ status: "CANCELADA", cancelRequestedAt: new Date() }).label).toBe("Cancelada");
  });
});

describe("diárias cobradas no site", () => {
  it("conta os dias do evento, sem a margem", async () => {
    const { eventDays } = await import("@/lib/booking");
    expect(eventDays("2026-10-10", "2026-10-12")).toBe(3);
    expect(eventDays("2026-10-10", "2026-10-10")).toBe(1);
    expect(eventDays("2026-12-31", "2027-01-01")).toBe(2);
  });
});
