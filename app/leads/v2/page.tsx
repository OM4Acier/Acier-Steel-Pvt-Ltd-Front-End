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

import React, { useState } from "react";
import LeadCardV2, { LeadCardV2Props } from "@/app/leads/components/LeadCardV2";

// --- Dummy data (no API calls). Dates are ISO so the card formatter is exercised. ---
const DUMMY_LEADS: LeadCardV2Props[] = [
  {
    clientName: "LLOYD INSULATIONS (INDIA) LTD",
    leadId: "LD-00562",
    phone: "8080544232",
    isHot: true,
    reminderDate: "2026-08-24",
    createdDate: "2026-08-22",
    createdByName: "Mayur",
  },
  {
    clientName: "LLOYD INSULATIONS (INDIA) LTD",
    leadId: "LD-00562",
    phone: "8080544232",
    isHot: false,
    reminderDate: "2026-08-24",
    createdDate: "2026-08-22",
    createdByName: "Mayur",
  },
  {
    clientName: "ACIER STEEL EXPRESS PVT LTD",
    leadId: "LD-00741",
    phone: "9820123400",
    isHot: false,
    reminderDate: "2026-08-28",
    createdDate: "2026-08-20",
    createdByName: "Rohit",
  },
  {
    clientName: "TATA ADVANCED SYSTEMS",
    leadId: "LD-00813",
    phone: "9123456789",
    isHot: true,
    reminderDate: "2026-08-30",
    createdDate: "2026-08-19",
    createdByName: "Priya",
  },
];

export default function LeadsV2Page() {
  // Track hot state per lead so the flame toggle (and the dropdown's toggle) persists.
  const [hotState, setHotState] = useState<Record<number, boolean>>(
    Object.fromEntries(DUMMY_LEADS.map((l, i) => [i, l.isHot ?? false]))
  );

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
              isHot={hotState[i]}
              onToggleHot={(next) => setHotState((s) => ({ ...s, [i]: next }))}
              onMarkWon={() => alert(`Mark as Won: ${lead.leadId}`)}
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
