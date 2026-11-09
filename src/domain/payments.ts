import { EntryError, plainText } from "./entries";
/** Deliberately bounded ISO 4217 set for the offer; no implicit currency conversion. */
export const currencyDigits: Readonly<Record<string, number>> = {
  CAD: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  CHF: 2,
  JPY: 0,
  KWD: 3,
};
export const maxMinor = 100000000;
export function currencyCode(raw: unknown): string {
  if (typeof raw !== "string" || !Object.hasOwn(currencyDigits, raw))
    throw new EntryError(
      "Choose a supported currency: CAD, USD, EUR, GBP, CHF, JPY or KWD.",
    );
  return raw;
}
export function minorAmount(raw: unknown, zero = true): number {
  if (
    !Number.isSafeInteger(raw) ||
    Number(raw) < (zero ? 0 : 1) ||
    Number(raw) > maxMinor
  )
    throw new EntryError("Use a whole minor-unit amount within 0–100,000,000.");
  return Number(raw);
}
export type FeeTerms = Readonly<{
  feeMinor: number;
  currency: string;
  paymentTerms: string;
}>;
export function feeTerms(raw: unknown): FeeTerms {
  if (!raw || typeof raw !== "object")
    throw new EntryError("Complete the fee terms.");
  const v = raw as FeeTerms;
  return Object.freeze({
    feeMinor: minorAmount(v.feeMinor),
    currency: currencyCode(v.currency),
    paymentTerms: plainText(v.paymentTerms, 2000),
  });
}
export function parseMoney(raw: string, currency: string): number {
  const digits = currencyDigits[currencyCode(currency)];
  const pattern =
    digits === 0 ? /^\d+$/ : new RegExp(`^\\d+(?:\\.\\d{1,${digits}})?$`);
  if (!pattern.test(raw) || raw.length > 15)
    throw new EntryError(
      `Enter a nonnegative ${currency} amount with at most ${digits} decimal places.`,
    );
  const [whole, fraction = ""] = raw.split(".");
  return minorAmount(
    Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, "0")),
  );
}
export function formatMoney(amount: number, currency: string): string {
  const digits = currencyDigits[currencyCode(currency)];
  minorAmount(amount);
  return `${currency} ${(amount / 10 ** digits).toFixed(digits)}`;
}
export type Credit = { kind: string; amountMinor: number; currency: string };
export function creditAmount(
  kind: string,
  amount: unknown,
  due: number,
): number {
  minorAmount(due);
  if (!["discount", "waiver", "external_receipt"].includes(kind))
    throw new EntryError(
      "Choose a discount, full remaining waiver or external receipt.",
    );
  const value = minorAmount(amount, false);
  if (value > due)
    throw new EntryError("This credit exceeds the current amount due.", 409);
  if (kind === "waiver" && value !== due)
    throw new EntryError(
      "A waiver must cover the full remaining amount due. Use a discount for a partial exception.",
    );
  return value;
}
export function reconcileCharge(terms: FeeTerms, history: readonly Credit[]) {
  const frozen = feeTerms(terms);
  let dueMinor = frozen.feeMinor,
    discountMinor = 0,
    waivedMinor = 0,
    externalMinor = 0;
  for (const h of history) {
    if (h.currency !== frozen.currency)
      throw new EntryError(
        "A charge and its credits must use the same currency. Currency conversion is not supported.",
      );
    const value = creditAmount(h.kind, h.amountMinor, dueMinor);
    dueMinor -= value;
    if (h.kind === "discount") discountMinor += value;
    if (h.kind === "waiver") waivedMinor += value;
    if (h.kind === "external_receipt") externalMinor += value;
  }
  return {
    feeMinor: frozen.feeMinor,
    discountMinor,
    waivedMinor,
    externalMinor,
    dueMinor,
    status:
      frozen.feeMinor === 0
        ? "no_fee"
        : dueMinor === 0
          ? "settled_by_records"
          : "amount_due",
  };
}
/** A financial record never reserves capacity. Re-evaluate with effective database-time admission. */
export function admissionAttention(
  state: string,
  balance: { dueMinor: number; externalMinor: number },
): "funds_without_place" | "cleared_without_place" | null {
  if (state === "accepted" || state === "held") return null;
  if (balance.externalMinor > 0) return "funds_without_place";
  return balance.dueMinor === 0 ? "cleared_without_place" : null;
}
