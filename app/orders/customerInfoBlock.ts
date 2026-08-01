// Shared helpers for the customer-info block stored in an order's invoiceDetails.
//
// The block is wrapped in an outer fence and each field is wrapped in its own
// identical fence tokens, so every field can be located and replaced
// independently (via regex search) when the customer is updated — without
// touching any operator-typed text around it.
//
// Final shape (visible to every role inside the invoice field):
//
//   `client-info-start`
//   `ci-client`*Client*: <name>`ci-client`
//   `ci-gst`*GST*: <gst>`ci-gst`
//   `ci-billing`*Billing Address*: <addr>`ci-billing`
//   `ci-shipping`*Shipping Address*: <addr>`ci-shipping`
//   `client-info-end`
//
// We use `...` single-backtick markers (NOT ``` code fences) because
// renderMarkdownText would treat ``` as a code block and visually mangle the
// rendered invoice.

export const CUSTOMER_INFO_START = '`client-info-start`';
export const CUSTOMER_INFO_END = '`client-info-end`';

export const CI_MARKERS = {
  client: '`ci-client`',
  gst: '`ci-gst`',
  billing: '`ci-billing`',
  shipping: '`ci-shipping`',
} as const;

export type CustomerField = keyof typeof CI_MARKERS;

/** Wrap a single customer field line between its own identical fence tokens. */
export const wrapCustomerField = (key: CustomerField, line: string): string =>
  `${CI_MARKERS[key]}${line}${CI_MARKERS[key]}`;

/** Build the full fenced customer-info block. Empty optional fields are skipped. */
export const buildCustomerInfoBlock = (d: {
  client: string;
  gst: string;
  billing: string;
  shipping: string;
}): string => {
  const lines = [
    wrapCustomerField('client', `*Client*: ${d.client}`),
    d.gst ? wrapCustomerField('gst', `*GST*: ${d.gst}`) : '',
    d.billing ? wrapCustomerField('billing', `*Billing Address*: ${d.billing}`) : '',
    wrapCustomerField('shipping', `*Shipping Address*: ${d.shipping}`),
  ].filter(Boolean);
  return `${CUSTOMER_INFO_START}\n${lines.join('\n')}\n${CUSTOMER_INFO_END}`;
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Replace (or insert) the whole fenced customer-info block inside a larger text.
 * Only the region between the outer fences is swapped — everything else is
 * preserved untouched. Any orphan `ci-*` field fences found OUTSIDE the block
 * (from legacy/partial writes) are stripped so they don't dangle. If no block
 * exists, it is prepended.
 */
export const replaceCustomerInfoBlock = (text: string, block: string): string => {
  const re = new RegExp(
    `${escapeRe(CUSTOMER_INFO_START)}[\\s\\S]*?${escapeRe(CUSTOMER_INFO_END)}`,
  );
  let result: string;
  if (re.test(text)) {
    result = text.replace(re, block);
  } else {
    const trimmed = text.trim();
    result = trimmed ? `${block}\n\n${trimmed}` : block;
  }
  // Strip orphaned ci-* fences that sit OUTSIDE the block (from legacy/partial
  // writes) so they don't dangle. The fresh `block` already contains correct
  // ci-* fences, so we only touch the text outside the outer fence.
  const stripOrphans = (s: string) => {
    let out = s;
    for (const fence of Object.values(CI_MARKERS)) {
      const fRe = new RegExp(`${escapeRe(fence)}[\\s\\S]*?${escapeRe(fence)}`, 'g');
      out = out.replace(fRe, '');
    }
    return out.replace(/\n{3,}/g, '\n\n').trim();
  };
  const startMatch = result.indexOf(CUSTOMER_INFO_START);
  const endMatch = result.indexOf(CUSTOMER_INFO_END);
  if (startMatch !== -1 && endMatch > startMatch) {
    const before = result.substring(0, startMatch);
    const blockPart = result.substring(startMatch, endMatch + CUSTOMER_INFO_END.length);
    const after = result.substring(endMatch + CUSTOMER_INFO_END.length);
    result = `${stripOrphans(before)}\n\n${blockPart}\n\n${stripOrphans(after)}`.replace(/\n{3,}/g, '\n\n').trim();
  } else {
    result = stripOrphans(result);
  }
  return result;
};

/**
 * Replace a single customer field (by its own fence) inside a larger text.
 * - If the field fence already exists, swap its inner content.
 * - If it doesn't exist but the outer block does, insert it just BEFORE the
 *   `client-info-end` fence (so it stays inside the block).
 * - Otherwise append it to the end.
 * All other text is preserved untouched.
 */
export const replaceCustomerField = (
  text: string,
  key: CustomerField,
  line: string,
): string => {
  const fence = CI_MARKERS[key];
  const re = new RegExp(`${escapeRe(fence)}[\\s\\S]*?${escapeRe(fence)}`);
  const replacement = `${fence}${line.trim()}${fence}`;
  if (re.test(text)) return text.replace(re, replacement);
  // Field not present yet. If the outer block exists, insert inside it
  // (right before the closing fence) so it doesn't dangle outside.
  const startIdx = text.indexOf(CUSTOMER_INFO_START);
  const endIdx = text.indexOf(CUSTOMER_INFO_END);
  if (startIdx !== -1 && endIdx > startIdx) {
    const before = text.substring(0, endIdx);
    const after = text.substring(endIdx);
    return `${before}\n${replacement}\n${after}`;
  }
  // No block at all — append at the end.
  const trimmed = text.trim();
  return trimmed ? `${trimmed}\n${replacement}` : replacement;
};
