/**
 * Pack image map for hosted Customer Accounts Order Status.
 * Uses live CDN files already assigned on Mood Gummies variants.
 * Prefer line attribute `_kefey_pack_image` when present.
 */
export const PACK_IMAGES = {
  1: 'https://cdn.shopify.com/s/files/1/0752/1556/9124/files/1-Pack.png',
  2: 'https://cdn.shopify.com/s/files/1/0752/1556/9124/files/2-Packs.png',
  3: 'https://cdn.shopify.com/s/files/1/0752/1556/9124/files/3-Pakcs.png',
  4: 'https://cdn.shopify.com/s/files/1/0752/1556/9124/files/4-Packs.png',
  5: 'https://cdn.shopify.com/s/files/1/0752/1556/9124/files/5-Packs.png',
  6: 'https://cdn.shopify.com/s/files/1/0752/1556/9124/files/6-Packs.png',
};

export function attributeValue(attributes, key) {
  if (!attributes || !attributes.length) return '';
  const match = attributes.find((entry) => entry && entry.key === key);
  return match && match.value ? String(match.value).trim() : '';
}

export function inferPackSize(line) {
  const fromProp = Number.parseInt(attributeValue(line?.attributes, '_kefey_pack_size'), 10);
  if (fromProp >= 1 && fromProp <= 6) return fromProp;

  const title = String(
    [
      line?.merchandise?.title,
      line?.merchandise?.product?.title,
      ...(line?.merchandise?.selectedOptions || []).map((option) => option?.value),
    ]
      .filter(Boolean)
      .join(' ')
  ).toLowerCase();

  if (title.includes('big smile') || title.includes('5 pack')) return 5;
  if (title.includes('joyful trio') || title.includes('3 pack')) return 3;
  if (title.includes('6 pack')) return 6;
  if (title.includes('4 pack')) return 4;
  if (title.includes('2 pack')) return 2;
  if (title.includes('extra tube') || title.includes('one-time')) return 1;

  const qty = Number(line?.quantity || 0);
  if (qty >= 1 && qty <= 6) return qty;
  return 1;
}

export function resolvePackImage(line) {
  const fromProp = attributeValue(line?.attributes, '_kefey_pack_image');
  if (fromProp) return fromProp;

  const pack = inferPackSize(line);
  return PACK_IMAGES[pack] || PACK_IMAGES[1];
}

export function purchaseLabel(line) {
  const type = attributeValue(line?.attributes, '_kefey_purchase_type');
  const bundle = attributeValue(line?.attributes, '_kefey_bundle');
  const discount = attributeValue(line?.attributes, '_kefey_bundle_discount_label');

  if (type === 'sub' || line?.merchandise?.sellingPlan) return 'Subscription';
  if (bundle || type === 'bundle') {
    return discount ? `Bundle · ${discount}` : 'Bundle';
  }
  return '';
}
