import { describe, expect, it } from "vitest";
import { peakUsage } from "@/server/availability";
import { effectiveStatus } from "@/lib/domain";

describe("peakUsage (pico de ocupação simultânea)", () => {
  it("soma apenas o que se sobrepõe no mesmo instante", () => {
    const intervals = [
      { start: 0, end: 10, qty: 10 },
      { start: 5, end: 15, qty: 8 },
      { start: 20, end: 30, qty: 20 },
    ];
    expect(peakUsage(intervals, 0, 16)).toBe(18);
    expect(peakUsage(intervals, 10, 16)).toBe(8);
    expect(peakUsage(intervals, 16, 20)).toBe(0);
    expect(peakUsage(intervals, 0, 100)).toBe(20);
  });

  it("devolução e nova saída no mesmo instante não se somam", () => {
    expect(peakUsage([{ start: 0, end: 10, qty: 5 }, { start: 10, end: 20, qty: 5 }], 0, 20)).toBe(5);
  });

  it("período vazio não ocupa nada", () => {
    expect(peakUsage([], 0, 10)).toBe(0);
  });
});

describe("effectiveStatus (locações atrasadas)", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  it("marca como ATRASADA quem saiu e passou do retorno previsto", () => {
    expect(effectiveStatus({ status: "SAIU", expectedReturnAt: new Date("2026-10-09T12:00:00Z") }, now)).toBe("ATRASADA");
    expect(effectiveStatus({ status: "EM_EVENTO", expectedReturnAt: new Date("2026-10-10T11:59:00Z") }, now)).toBe("ATRASADA");
  });
  it("não marca quem ainda está no prazo ou já voltou", () => {
    expect(effectiveStatus({ status: "SAIU", expectedReturnAt: new Date("2026-10-11T12:00:00Z") }, now)).toBe("SAIU");
    expect(effectiveStatus({ status: "CONFERIDA", expectedReturnAt: new Date("2026-10-01T12:00:00Z") }, now)).toBe("CONFERIDA");
    expect(effectiveStatus({ status: "RESERVADA", expectedReturnAt: new Date("2026-10-01T12:00:00Z") }, now)).toBe("RESERVADA");
  });
});
