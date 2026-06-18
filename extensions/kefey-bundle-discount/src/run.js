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
  const targets = [];

  for (const line of input.cart.lines) {
    const discountValue =
      line.bundleDiscount?.value || line.upsellDiscount?.value || "";

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

    targets.push({
      cartLine: {
        id: line.id,
      },
      value: {
        percentage: {
          value: String(percentage),
        },
      },
    });
  }

  if (!targets.length) {
    return {
      discounts: [],
      discountApplicationStrategy: DiscountApplicationStrategy.First,
    };
  }

  return {
    discounts: [
      {
        targets,
        message: "Kefey offer discount",
      },
    ],
    discountApplicationStrategy: DiscountApplicationStrategy.All,
  };
}
