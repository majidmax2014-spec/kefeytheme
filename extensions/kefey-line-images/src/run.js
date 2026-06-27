// @ts-check

/**
 * @typedef {import("../generated/api").RunInput} RunInput
 * @typedef {import("../generated/api").FunctionRunResult} FunctionRunResult
 */

/**
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {
  /** @type {FunctionRunResult["operations"]} */
  const operations = [];

  for (const line of input.cart.lines) {
    const imageUrl = line.packImage?.value?.trim();

    if (!imageUrl) {
      continue;
    }

    operations.push({
      update: {
        cartLineId: line.id,
        image: {
          url: imageUrl,
        },
      },
    });
  }

  return { operations };
}
