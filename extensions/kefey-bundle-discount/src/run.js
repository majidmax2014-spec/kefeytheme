// @ts-check
import { DiscountApplicationStrategy } from "../generated/api";

/**
 * @typedef {import("../generated/api").RunInput} RunInput
 * @typedef {import("../generated/api").FunctionRunResult} FunctionRunResult
 */

/**
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {
  /** @type {FunctionRunResult["discounts"]} */
  const discounts = [];

  for (const line of input.cart.lines) {
    const isBundle = Boolean(line.bundleDiscount?.value);
    const discountValue = isBundle
      ? line.bundleDiscount?.value
      : line.upsellDiscount?.value || "";

    if (!discountValue) {
      continue;
    }

    const percentage = Number.parseFloat(discountValue, 10);

    if (!Number.isFinite(percentage) || percentage <= 0) {
      continue;
    }

    if (line.merchandise.__typename !== "ProductVariant") {
      continue;
    }

    const rawLabel = isBundle
      ? line.bundleDiscountLabel?.value
      : line.upsellDiscountLabel?.value;
    const message = rawLabel?.trim() || "Kefey offer discount";

    discounts.push({
      targets: [
        {
          cartLine: {
            id: line.id,
          },
        },
      ],
      value: {
        percentage: {
          value: String(percentage),
        },
      },
      message,
    });
  }

  if (!discounts.length) {
    return {
      discounts: [],
      discountApplicationStrategy: DiscountApplicationStrategy.First,
    };
  }

  return {
    discounts,
    discountApplicationStrategy: DiscountApplicationStrategy.All,
  };
}
