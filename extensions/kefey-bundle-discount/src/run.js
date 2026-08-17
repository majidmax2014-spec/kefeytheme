// @ts-check
import { DiscountApplicationStrategy } from "../generated/api";

/**
 * @typedef {import("../generated/api").RunInput} RunInput
 * @typedef {import("../generated/api").FunctionRunResult} FunctionRunResult
 */

const BUNDLE_PERCENT_BY_KEY = {
  "joyful-trio": 15,
  "big-smile": 25,
};

const STRATEGY_ALL = DiscountApplicationStrategy.All || "ALL";
const STRATEGY_FIRST = DiscountApplicationStrategy.First || "FIRST";

/**
 * @param {string | null | undefined} raw
 * @returns {number}
 */
function parsePercentage(raw) {
  const percentage = Number.parseFloat(String(raw || ""), 10);
  return Number.isFinite(percentage) && percentage > 0 ? percentage : 0;
}

/**
 * @param {RunInput["cart"]["lines"][number]} line
 * @returns {number}
 */
function resolvePercentage(line) {
  const bundlePercentage = parsePercentage(line.bundleDiscount?.value);
  if (bundlePercentage) return bundlePercentage;

  const bundleKey = (line.bundleKey?.value || "").trim();
  if (bundleKey && BUNDLE_PERCENT_BY_KEY[bundleKey]) {
    return BUNDLE_PERCENT_BY_KEY[bundleKey];
  }

  return parsePercentage(line.upsellDiscount?.value);
}

/**
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {
  /** @type {FunctionRunResult["discounts"]} */
  const discounts = [];

  for (const line of input.cart.lines) {
    const percentage = resolvePercentage(line);

    if (!percentage) continue;
    if (line.merchandise.__typename !== "ProductVariant") continue;

    const isBundle = Boolean(line.bundleKey?.value || line.bundleDiscount?.value);
    const rawLabel = isBundle
      ? line.bundleDiscountLabel?.value
      : line.upsellDiscountLabel?.value;
    const message = rawLabel?.trim() || "Kefey offer discount";
    const subtotal = Number.parseFloat(line.cost?.subtotalAmount?.amount || "0", 10);

    /** @type {FunctionRunResult["discounts"][number]["value"]} */
    let value;
    if (Number.isFinite(subtotal) && subtotal > 0) {
      value = {
        fixedAmount: {
          amount: ((subtotal * percentage) / 100).toFixed(2),
          appliesToEachItem: false,
        },
      };
    } else {
      value = {
        percentage: {
          value: String(percentage),
        },
      };
    }

    discounts.push({
      targets: [
        {
          cartLine: {
            id: line.id,
          },
        },
      ],
      value,
      message,
    });
  }

  return {
    discounts,
    discountApplicationStrategy: discounts.length ? STRATEGY_ALL : STRATEGY_FIRST,
  };
}
