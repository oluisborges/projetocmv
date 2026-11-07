import { describe, expect, it } from "vitest";
import { baseFactor, parsePaid, parsePurchaseQty, qtyToField } from "./purchase-qty";

describe("quantidade comprada", () => {
  it("campo na unidade de compra: 7.500 g viram 7,5 kg", () => {
    expect(qtyToField(7500, "kg")).toBe("7,5");
    expect(qtyToField(250, "g")).toBe("250");
    expect(qtyToField(1500, "ml")).toBe("1500");
    expect(qtyToField(2000, "l")).toBe("2");
    expect(baseFactor("kg")).toBe(1000);
    expect(baseFactor("un")).toBe(1);
  });

  it("o cliente comprou mais que a lista: 12 kg no lugar de 10 kg", () => {
    expect(parsePurchaseQty("12", "kg", "kg")).toEqual({ qty: 12000 });
    expect(parsePurchaseQty("2,5", "kg", "kg")).toEqual({ qty: 2500 });
    expect(parsePurchaseQty("500", "g", "kg")).toEqual({ qty: 500 });
    expect(parsePurchaseQty("3", "un", "un")).toEqual({ qty: 3 });
  });

  it("recusa vazio, zero, unidade que não combina e quantidade absurda", () => {
    expect("error" in parsePurchaseQty("", "kg", "kg")).toBe(true);
    expect("error" in parsePurchaseQty("0", "kg", "kg")).toBe(true);
    expect("error" in parsePurchaseQty("2", "l", "kg")).toBe(true);
    expect("error" in parsePurchaseQty("999999999", "kg", "kg")).toBe(true);
  });

  it("valor pago: vírgula, vazio e inválido", () => {
    expect(parsePaid("48,90")).toBe(48.9);
    expect(parsePaid("")).toBeNull();
    expect(parsePaid("  ")).toBeNull();
    expect(parsePaid("abc")).toBeUndefined();
    expect(parsePaid("-3")).toBeUndefined();
  });
});
