/**
 * generateOrderPdf.ts
 * ───────────────────────────────────────────────────────────────────
 * Builds a print-ready HTML document for an order and opens it in a
 * new browser tab. The user can then Ctrl+P / Print → Save as PDF.
 *
 * Design:
 *  • A4 page size enforced via @page CSS
 *  • Fixed header & footer printed on every page (Chrome / Edge / Firefox)
 *  • Field visibility comes from the role-based PdfFieldVisibilityMap
 *  • No external PDF library — works in every modern browser
 */

import { Order } from './types';
import { PdfFieldVisibilityMap } from './pdfConfig';
import { renderMarkdownText } from '@/components/markdownRenderer';

// ─── Helpers ────────────────────────────────────────────────────────

function escHtml(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br/>');
}

function formatPaymentStatus(val: string | undefined): string {
  if (val === 'new-paid') return 'New Customer – Paid';
  if (val === 'new-unpaid') return 'New Customer – Unpaid';
  if (val === 'regular') return 'Regular';
  return val || 'N/A';
}

function formatTransportProvider(val: string | undefined, name: string | undefined): string {
  if (val === 'client') return 'Client Transport';
  if (val === 'own') return `Own Transport${name ? ` (${name})` : ''}`;
  return val || 'N/A';
}

function show(id: string, vis: PdfFieldVisibilityMap): boolean {
  return vis[id] === true;
}

// ─── CSS ────────────────────────────────────────────────────────────

function buildCss(): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Bodoni+Moda:wght@400;500;600;700&family=Nunito+Sans:wght@300;400;600;700;800&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    @page {
      size: A4;
      margin: 15mm;
    }

    body {
      font-family: 'Nunito Sans';
      font-size: 11px;
      color: #020617;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      line-height: 1.6;
    }

    .pdf-document { 
      background: white; 
      display: flex;
      flex-direction: column;
      min-height: 100%;
    }

    /* ── Header ─────────────────────────────── */
    #pdf-header {
      background: #0F172A;
      color: #F8FAFC;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 5mm 15mm;
      border-bottom: 5px solid #0369A1;
    }
    #pdf-header .company { 
      font-size: 20px; 
      font-weight: 700; 
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    #pdf-header .company small { 
      font-size: 10px; 
      font-weight: 300; 
      display: block; 
      opacity: 0.8; 
      margin-top: 2px;
      letter-spacing: 3px;
    }
    #pdf-header .order-badge {
      text-align: right;
    }
    #pdf-header .order-badge .deo { 
      font-size: 24px; 
      font-weight: 700; 
    }
    #pdf-header .order-badge .dt { 
      font-size: 9px; 
      opacity: 0.7; 
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }

    /* ── Content ────────────────────────────────────────────────── */
    #pdf-content { 
      padding: 2mm 8mm; 
      flex-grow: 1;
    }

    .doc-title {
      text-align: center;
      margin-bottom: 6mm;
      padding-bottom: 3mm;
      border-bottom: 1px solid #E2E8F0;
    }
    .doc-title h1 { 
      font-size: 26px; 
      font-weight: 500; 
      color: #0F172A;
      letter-spacing: 3px;
      text-transform: uppercase;
    }
    .doc-title p { 
      font-size: 10px; 
      color: #64748B; 
      margin-top: 4px; 
      letter-spacing: 4px;
      text-transform: uppercase;
    }

    .section-heading {
      color: #0F172A;
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 2px;
      padding: 2mm 0;
      margin: 2mm 0 3mm;
      border-bottom: 2.5px solid #0F172A;
    }

    .field-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3mm 10mm;
      margin-bottom: 4mm;
    }

    .field-item { 
      border-bottom: 1px solid #F1F5F9; 
    }
    .field-label {
      font-size: 9px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      margin-bottom: 1mm;
    }
    .field-value { 
      font-size: 12px; 
      color: #0F172A; 
      font-weight: 400;
    }

    /* Badges */
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 1mm 4mm;
      border-radius: 6px;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    .badge-blue    { background: #EFF6FF; color: #1E40AF; border: 1px solid #DBEAFE; }
    .badge-green   { background: #F0FDF4; color: #166534; border: 1px solid #DCFCE7; }
    .badge-yellow  { background: #FEFCE8; color: #854D0E; border: 1px solid #FEF9C3; }
    .badge-red     { background: #FEF2F2; color: #991B1B; border: 1px solid #FEE2E2; }
    .badge-purple  { background: #FAF5FF; color: #6B21A8; border: 1px solid #F3E8FF; }
    .badge-gray    { background: #F8FAFC; color: #334155; border: 1px solid #E2E8F0; }
    .badge-orange  { background: #FFF7ED; color: #9A3412; border: 1px solid #FFEDD5; }
    .badge-priority { 
      background: #0F172A; 
      color: #F8FAFC; 
      border: none;
    }

    .product-block {
      background: #F8FAFC;
      border-left: 5px solid #0F172A;
      padding: 4mm 6mm;
      font-size: 11.5px;
      margin: 3mm 0;
    }

    .markdown-content strong { font-weight: 700; color: #0F172A; }
    .markdown-content h3 { 
      font-size: 16px; 
      margin-top: 3mm; 
      color: #0F172A;
      border-bottom: 1px solid #E2E8F0;
      padding-bottom: 1.5mm;
    }

    .signature-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 15mm;
      margin-top: 15mm;
    }
    .sig-box {
      border-top: 2px solid #0F172A;
      padding-top: 3mm;
      text-align: center;
      font-size: 10px;
      font-weight: 700;
      color: #0F172A;
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }

    /* ── Footer ─────────────────────────────── */
    #pdf-footer {
      background: #F8FAFC;
      border-top: 1px solid #E2E8F0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6mm 15mm;
      font-size: 9.5px;
      color: #64748B;
    }
    #pdf-footer .disclaimer { max-width: 65%; line-height: 1.6; font-weight: 400; }
    #pdf-footer .page-info  { text-align: right; font-weight: 600; }

    .priority-banner {
      background: #991B1B;
      color: #fff;
      text-align: center;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 5px;
      padding: 3mm;
      margin-bottom: 5mm;
      text-transform: uppercase;
    }

    @media screen {
      body { background: #F1F5F9; padding: 20px 0; }
      .pdf-document { 
        width: 210mm; 
        margin: 0 auto; 
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); 
        min-height: 297mm;
      }
    }

    @media print {
      .no-print { display: none !important; }
      .pdf-document { width: 100%; box-shadow: none; }
    }
  `;
}

// ─── Status badge helper ─────────────────────────────────────────────

function statusBadge(status: string | undefined): string {
  const map: Record<string, string> = {
    'Order Created': 'badge-blue',
    'Approved for Production': 'badge-purple',
    'Ready for Dispatch': 'badge-yellow',
    'Dispatched and Invoiced': 'badge-orange',
    'Completed': 'badge-green',
    'Cancelled': 'badge-red',
  };
  const cls = map[status || ''] || 'badge-gray';
  return `<span class="badge ${cls}">${escHtml(status) || 'N/A'}</span>`;
}

function paymentBadge(val: string | undefined): string {
  const cls = val === 'new-unpaid' ? 'badge-red' : val === 'new-paid' ? 'badge-green' : 'badge-blue';
  return `<span class="badge ${cls}">${formatPaymentStatus(val)}</span>`;
}

// ─── Section builder ────────────────────────────────────────────────

function row(label: string, value: string, full = false): string {
  return `
    <div class="field-item${full ? ' full-width' : ''}">
      <div class="field-label">${label}</div>
      <div class="field-value">${value}</div>
    </div>`;
}

// ─── Main builder ───────────────────────────────────────────────────

export function buildOrderPdfHtml(
  order: Order,
  fieldVisibility: PdfFieldVisibilityMap,
  generatedBy: string,
): string {
  const v = fieldVisibility;
  const d = order.details;
  const now = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).toUpperCase();

  // ── Client & Status block ─────────────────────────────────────
  const clientRows: string[] = [];
  if (show('deoNo', v)) clientRows.push(row('Order No.', `<strong>${escHtml(order.deoNo)}</strong>`));
  if (show('client', v)) clientRows.push(row('Client Name', escHtml(order.client)));
  if (show('contactNo', v)) clientRows.push(row('Contact No.', escHtml(order.contactNo) || 'N/A'));
  if (show('organizationContact', v)) clientRows.push(row('Org. Contact', escHtml(order.organizationContact) || 'N/A'));
  if (show('orderDate', v)) clientRows.push(row('Order Date', escHtml(d?.orderDate) || 'N/A'));

  const statusRows: string[] = [];
  if (show('status', v)) statusRows.push(row('Order Status', statusBadge(order.status)));
  if (show('customerPaymentStatus', v)) statusRows.push(row('Payment Status', paymentBadge(order.customerPaymentStatus)));
  if (show('isHighPriority', v)) statusRows.push(row('High Priority', order.isHighPriority ? '<span class="badge badge-priority">⚡ YES</span>' : '<span class="badge badge-gray">No</span>'));
  if (show('partDelivery', v)) statusRows.push(row('Part Delivery', order.partDelivery ? '<span class="badge badge-orange">Yes</span>' : '<span class="badge badge-gray">No</span>'));

  // ── Delivery block ────────────────────────────────────────────
  const deliveryRows: string[] = [];
  if (show('vehicleNo', v)) deliveryRows.push(row('Vehicle No.', escHtml(d?.vehicleNo) || 'N/A'));
  if (show('weightScaleType', v)) deliveryRows.push(row('Weight Scale', d?.weightScaleType ? (d.weightScaleType.charAt(0).toUpperCase() + d.weightScaleType.slice(1)) : 'N/A'));
  if (show('transportProvider', v)) deliveryRows.push(row('Transport', formatTransportProvider(d?.transportProvider, d?.transportProviderName)));
  if (show('siteDeliveryInfo', v)) deliveryRows.push(row('Site Delivery Info', d?.siteDeliveryInfo ? `<div class="markdown-content">${renderMarkdownText(d.siteDeliveryInfo)}</div>` : 'N/A', true));

  // ── Invoice block ─────────────────────────────────────────────
  const invoiceRows: string[] = [];
  if (show('invoiceNo', v)) invoiceRows.push(row('Invoice No.', `<strong>${escHtml(d?.invoiceNo) || 'N/A'}</strong>`));
  if (show('invoiceDetails', v)) invoiceRows.push(row('Invoice Notes', d?.invoiceDetails ? `<div class="markdown-content">${renderMarkdownText(d.invoiceDetails)}</div>` : 'N/A', true));

  // ── Assemble sections ─────────────────────────────────────────
  let body = '';

  if (order.isHighPriority && show('isHighPriority', v)) {
    body += `<div class="priority-banner">⚡ HIGH PRIORITY ORDER ⚡</div>`;
  }
  if (clientRows.length) {
    body += `<div class="section-heading">Client Information</div>
             <div class="field-grid">${clientRows.join('')}</div>`;
  }

  if (statusRows.length) {
    body += `<div class="section-heading">Order Status</div>
             <div class="field-grid">${statusRows.join('')}</div>`;
  }

  if (show('products', v)) {
    body += `<div class="section-heading">Product Details</div>
             <div class="product-block markdown-content">${order.products ? renderMarkdownText(order.products) : 'N/A'}</div>`;
  }

  if (deliveryRows.length) {
    body += `<div class="section-heading">Delivery &amp; Vehicle</div>
             <div class="field-grid">${deliveryRows.join('')}</div>`;
  }

  if (invoiceRows.length) {
    body += `<div class="section-heading">Invoice Details</div>
             <div class="field-grid">${invoiceRows.join('')}</div>`;
  }


  // ── Full HTML document ────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Order ${escHtml(order.deoNo)} — NSC</title>
  <style>${buildCss()}</style>
</head>
<body>

  <div class="pdf-document">
    <!-- Header -->
    <div id="pdf-header">
      <div class="company">
        Acier Steel Pvt. Ltd.
        <small>Steel Trading • Industrial Supply</small>
      </div>
      <div class="order-badge">
        <div class="deo">${escHtml(order.deoNo)}</div>
        <div class="dt">Generated: ${now}</div>
      </div>
    </div>

    <!-- Content -->
    <div id="pdf-content">
      ${body}
    </div>

    <!-- Footer -->
    <div id="pdf-footer">
      <div class="disclaimer">
        This document is confidential and intended solely for authorized personnel of National Steel Corporation. 
        Unauthorised reproduction or distribution is strictly prohibited.
      </div>
      <div class="page-info">
        Exported by: <strong>${escHtml(generatedBy)}</strong>
      </div>
    </div>
  </div>

  <!-- Action Buttons (hidden when printing) -->
  <div class="no-print" style="
    position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); z-index: 999;
    display: flex; gap: 15px; background: rgba(15, 23, 42, 0.95);
    padding: 14px 28px; border-radius: 60px; border: 1px solid rgba(255,255,255,0.15);
    box-shadow: 0 25px 30px -5px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(16px);
  ">
    <button
      onclick="window.print()"
      title="Save as PDF using browser's print dialog"
      style="
        background:#0369A1; color:#fff; border:none; border-radius:30px;
        padding:12px 24px; font-size:13px; font-weight:700; cursor:pointer;
        display:flex; align-items:center; gap:10px; font-family:'Nunito Sans';
        transition: all 0.2s ease;
      "
    >
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
      PRINT DOCUMENT
    </button>
    <button
      onclick="window.close()"
      style="
        background:rgba(255,255,255,0.1); color:#F8FAFC; border:1px solid rgba(248,250,252,0.2);
        border-radius:30px; padding:12px 24px; font-size:13px; font-weight:600; cursor:pointer;
        display:flex; align-items:center; gap:10px; font-family:'Nunito Sans';
        transition: all 0.2s ease;
      "
    >
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"></path></svg>
      CLOSE PREVIEW
    </button>
  </div>

</body>
</html>`;
}

// ─── Public entry point ──────────────────────────────────────────────

/**
 * Opens a print-ready HTML page for the order in a new browser tab.
 */
export function openOrderPdfInNewTab(
  order: Order,
  fieldVisibility: PdfFieldVisibilityMap,
  generatedBy: string,
): void {
  const html = buildOrderPdfHtml(order, fieldVisibility, generatedBy);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const tab = window.open(url, '_blank');

  // Revoke object URL after the tab has loaded to free memory
  if (tab) {
    tab.addEventListener('load', () => {
      URL.revokeObjectURL(url);
    });
  }
}
