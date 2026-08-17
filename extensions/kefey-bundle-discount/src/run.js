// @ts-check

const BUNDLE_PERCENT_BY_KEY = {
  "joyful-trio": 15,
  "big-smile": 25,
};

/**
 * @param {string | null | undefined} raw
 * @returns {number}
 */
function parsePercentage(raw) {
  const percentage = Number.parseFloat(String(raw || ""), 10);
  return Number.isFinite(percentage) && percentage > 0 ? percentage : 0;
}

/**
 * @param {any} line
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
 * @param {any} input
 * @param {"PRODUCT" | "ORDER"} name
 */
function hasDiscountClass(input, name) {
  const classes = input?.discount?.discountClasses;
  if (!Array.isArray(classes) || classes.length === 0) return true;
  return classes.some((discountClass) => String(discountClass).toUpperCase() === name);
}

/**
 * Shopify only keeps one product discount per product. Big Smile and Joyful Trio
 * are the same Mood Gummies product, so SAVE15 is applied as an order discount.
 *
 * @param {any} input
 */
export function run(input) {
  /** @type {Array<{ id: string, amount: number, percentage: number, message: string }>} */
  const offers = [];

  for (const line of input.cart.lines) {
    const percentage = resolvePercentage(line);
    if (!percentage) continue;
    if (line.merchandise?.__typename !== "ProductVariant") continue;

    const isBundle = Boolean(line.bundleKey?.value || line.bundleDiscount?.value);
    const rawLabel = isBundle
      ? line.bundleDiscountLabel?.value
      : line.upsellDiscountLabel?.value;
    const message = (rawLabel || "").trim() || "Kefey offer discount";
    const subtotal = Number.parseFloat(line.cost?.subtotalAmount?.amount || "0", 10);
    if (!Number.isFinite(subtotal) || subtotal <= 0) continue;

    offers.push({
      id: line.id,
      amount: (subtotal * percentage) / 100,
      percentage,
      message,
    });
  }

  if (!offers.length) {
    return { operations: [] };
  }

  offers.sort((a, b) => b.amount - a.amount);
  const [primary, ...remaining] = offers;
  /** @type {any[]} */
  const operations = [];

  if (hasDiscountClass(input, "PRODUCT")) {
    operations.push({
      productDiscountsAdd: {
        selectionStrategy: "FIRST",
        candidates: [
          {
            message: primary.message,
            targets: [{ cartLine: { id: primary.id } }],
            value: {
              fixedAmount: {
                amount: primary.amount.toFixed(2),
              },
            },
          },
        ],
      },
    });
  }

  const orderAmount = remaining.reduce((sum, offer) => sum + offer.amount, 0);
  if (orderAmount > 0 && hasDiscountClass(input, "ORDER")) {
    operations.push({
      orderDiscountsAdd: {
        selectionStrategy: "FIRST",
        candidates: [
          {
            message: remaining.map((offer) => offer.message).join(" + ") || "SAVE15",
            targets: [{ orderSubtotal: { excludedCartLineIds: [] } }],
            value: {
              fixedAmount: {
                amount: orderAmount.toFixed(2),
              },
            },
          },
        ],
      },
    });
  }

  return { operations };
}

/**
 * @returns {{ operations: any[] }}
 */
export function delivery() {
  return { operations: [] };
}
