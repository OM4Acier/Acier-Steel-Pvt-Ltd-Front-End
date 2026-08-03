// Shared helpers for the customer-info block stored in an order's invoiceDetails.
//
// Stored shape (invisible to the user in rendered markdown):
//
//   <!--client-info-start-->
//   *Client*: <name>
//   *GST*: <gst>
//   *Billing Address*: <address>
//   *Shipping Address*: <address>
//   <!--client-info-end-->
//
// We use HTML comment fences (<!-- -->) because renderMarkdownText strips them
// from the rendered output, so the user sees ONLY the clean field lines — no
// extra markers, no backtick noise.

export const CUSTOMER_INFO_START = '<!--client-info-start-->';
export const CUSTOMER_INFO_END = '<!--client-info-end-->';

/** Field prefixes used inside the block (must match the line start). */
export const FIELD_PREFIXES: Record<string, string> = {
  client: '*Client*:',
  gst: '*GST*:',
  billing: '*Billing Address*:',
  shipping: '*Shipping Address*:',
};

export type CustomerField = keyof typeof FIELD_PREFIXES;

/** Build the full fenced customer-info block. Empty optional fields are skipped. */
export const buildCustomerInfoBlock = (d: {
  client: string;
  gst: string;
  billing: string;
  shipping: string;
}): string => {
  const lines = [
    `${FIELD_PREFIXES.client} ${d.client}`,
    d.gst ? `${FIELD_PREFIXES.gst} ${d.gst}` : '',
    d.billing ? `${FIELD_PREFIXES.billing} ${d.billing}` : '',
    `${FIELD_PREFIXES.shipping} ${d.shipping}`,
  ].filter(Boolean);
  return `${CUSTOMER_INFO_START}\n${lines.join('\n')}\n${CUSTOMER_INFO_END}`;
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Replace (or insert) the whole fenced customer-info block inside a larger text.
 * Only the region between the HTML comment fences is swapped — everything else
 * is preserved untouched. If no block exists, it is prepended.
 */
export const replaceCustomerInfoBlock = (text: string, block: string): string => {
  const re = new RegExp(
    `${escapeRe(CUSTOMER_INFO_START)}[\\s\\S]*?${escapeRe(CUSTOMER_INFO_END)}`,
  );
  if (re.test(text)) return text.replace(re, block);
  const trimmed = text.trim();
  return trimmed ? `${block}\n\n${trimmed}` : block;
};

/**
 * Replace (or insert) a single customer field inside the fenced block.
 * - If the field line already exists, swap its value (preserves line position).
 * - If it doesn't exist, append it to the end of the block.
 * - If the block itself doesn't exist, create it with just this field.
 * All other text outside the block is preserved untouched.
 */
export const replaceCustomerField = (
  text: string,
  key: CustomerField,
  value: string,
): string => {
  const prefix = FIELD_PREFIXES[key];
  const newLine = `${prefix} ${value.trim()}`;
  const startIdx = text.indexOf(CUSTOMER_INFO_START);
  const endIdx = text.indexOf(CUSTOMER_INFO_END);

  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    // No block at all — create one with just this field, prepended.
    const block = `${CUSTOMER_INFO_START}\n${newLine}\n${CUSTOMER_INFO_END}`;
    const trimmed = text.trim();
    return trimmed ? `${block}\n\n${trimmed}` : block;
  }

  const before = text.substring(0, startIdx);
  const inside = text.substring(startIdx + CUSTOMER_INFO_START.length, endIdx);
  const after = text.substring(endIdx + CUSTOMER_INFO_END.length);

  const lines = inside.split('\n');
  const fieldIdx = lines.findIndex((l) => l.trim().startsWith(prefix));
  if (fieldIdx >= 0) {
    lines[fieldIdx] = newLine;
  } else {
    lines.push(newLine);
  }
  const newInside = lines.join('\n');
  return `${before}${CUSTOMER_INFO_START}${newInside}${CUSTOMER_INFO_END}${after}`.replace(/\n{3,}/g, '\n\n').trim();
};
