import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { resolvePackImage, purchaseLabel, inferPackSize } from './packImages';

export default async () => {
  render(<Extension />, document.body);
};

function Extension() {
  const line = shopify.target?.value || shopify.target;
  if (!line) return null;

  const imageUrl = resolvePackImage(line);
  const label = purchaseLabel(line);
  const pack = inferPackSize(line);
  const nativeUrl = line?.merchandise?.image?.url || '';

  // Skip when Shopify already shows the correct pack image.
  if (nativeUrl && imageUrl && nativeUrl.indexOf(packFilename(pack)) !== -1) {
    return label ? <s-text color="subdued">{label}</s-text> : null;
  }

  return (
    <s-stack direction="inline" gap="small" alignItems="center">
      <s-product-thumbnail src={imageUrl} alt={`Pack ${pack}`} size="small" />
      <s-stack gap="none">
        <s-text type="strong">{pack}-pack image</s-text>
        {label ? <s-text color="subdued">{label}</s-text> : null}
      </s-stack>
    </s-stack>
  );
}

function packFilename(pack) {
  if (pack === 3) return '3-Pakcs';
  if (pack === 1) return '1-Pack';
  return `${pack}-Pack`;
}
