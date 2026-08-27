import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { resolvePackImage, purchaseLabel, inferPackSize } from './packImages';

export default async () => {
  render(<Extension />, document.body);
};

function Extension() {
  const lines = shopify.lines?.value || [];
  if (!lines.length) return null;

  return (
    <s-section heading="Pack details">
      <s-stack gap="base">
        {lines.map((line) => {
          const imageUrl = resolvePackImage(line);
          const pack = inferPackSize(line);
          const label = purchaseLabel(line);
          const title = line?.merchandise?.title || 'Mood Gummies';

          return (
            <s-stack key={line.id} direction="inline" gap="base" alignItems="center">
              <s-product-thumbnail src={imageUrl} alt={title} size="base" />
              <s-stack gap="none">
                <s-text type="strong">{title}</s-text>
                <s-text color="subdued">
                  {pack} pack · Qty {line.quantity}
                  {label ? ` · ${label}` : ''}
                </s-text>
              </s-stack>
            </s-stack>
          );
        })}
      </s-stack>
    </s-section>
  );
}
