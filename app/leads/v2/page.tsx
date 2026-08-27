"use client";

/**
 * /leads/v2 — V2 Leads (standalone preview)
 * ------------------------------------------
 * Extended path under the existing /leads route. Renders the new LeadCardV2
 * component (recreated from docs/Frame 470 (1).svg) with DUMMY data only,
 * including both hot = true and hot = false variants. This page is intentionally
 * NOT wired into the V1 leads system / API and does not merge with
 * app/leads/page.tsx.
 */

import React from "react";
import LeadCardV2, { LeadCardV2Props } from "@/app/leads/components/LeadCardV2";

// --- Dummy data (no API calls) ---
const DUMMY_LEADS: LeadCardV2Props[] = [
  {
    clientName: "LLOYD INSULATIONS (INDIA) LTD",
    leadId: "LD-00562",
    phone: "8080544232",
    isHot: true,
    reminderDate: "24 Aug 2026",
    createdDate: "22 Aug 2026",
    createdByName: "Mayur",
  },
  {
    clientName: "LLOYD INSULATIONS (INDIA) LTD",
    leadId: "LD-00562",
    phone: "8080544232",
    isHot: false,
    reminderDate: "24 Aug 2026",
    createdDate: "22 Aug 2026",
    createdByName: "Mayur",
  },
  {
    clientName: "ACIER STEEL EXPRESS PVT LTD",
    leadId: "LD-00741",
    phone: "9820123400",
    isHot: false,
    reminderDate: "28 Aug 2026",
    createdDate: "20 Aug 2026",
    createdByName: "Rohit",
  },
  {
    clientName: "TATA ADVANCED SYSTEMS",
    leadId: "LD-00813",
    phone: "9123456789",
    isHot: true,
    reminderDate: "30 Aug 2026",
    createdDate: "19 Aug 2026",
    createdByName: "Priya",
  },
];

export default function LeadsV2Page() {
  return (
    <div className="min-h-screen bg-black p-8">
      <div className="mx-auto max-w-[860px]">
        <h1 className="mb-6 text-2xl font-bold text-white">
          Leads V2 <span className="text-sm font-normal text-white/50">(preview · dummy data)</span>
        </h1>
        <div className="flex flex-col gap-6">
          {DUMMY_LEADS.map((lead, i) => (
            <LeadCardV2
              key={`${lead.leadId}-${i}`}
              {...lead}
              onMarkWon={() => alert(`Mark as Won: ${lead.leadId}`)}
              onSort={() => alert(`Sort / filter: ${lead.leadId}`)}
              onCall={() => alert(`Call: ${lead.phone}`)}
              onWhatsApp={() => alert(`WhatsApp: ${lead.phone}`)}
              onEditReminder={() => alert(`Edit reminder: ${lead.leadId}`)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
