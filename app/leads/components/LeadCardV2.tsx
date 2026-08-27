"use client";

/**
 * LeadCardV2
 * -----------
 * Standalone V2 lead card, recreated from the Figma export `docs/Frame 470 (1).svg`
 * (which contains both hot = true and hot = false states). The ONLY visual
 * difference between the two states in the mock is the fire icon in the header:
 * filled orange when hot, grey outline when not. Everything else is identical.
 *
 * This is intentionally a SEPARATE component from the existing V1 LeadCard in
 * `app/leads/page.tsx` — it is NOT wired into the current leads system and must
 * not be merged with it. Text is exposed as props so it is a real component.
 *
 * Icon mapping (Figma ids -> assets in /public/icons):
 *   phone-outgoing      -> PhoneOutgoing (lucide)
 *   WHATASPP icon        -> /icons/whatsapp-brands-solid-full (2).svg
 *   bell                 -> Bell (lucide)
 *   pencil-line          -> Pencil (lucide)
 *   alarm-clock-check    -> AlarmClockCheck (lucide)
 *   circle-user          -> CircleUser (lucide)
 *   user-round-check     -> UserRoundCheck (lucide)
 *   List Arrow (google)  -> /icons/list_arrow_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg
 *   Vector (hot flame)   -> /icons/Frame.svg (gradient flame, toggled by isHot)
 */

import React from "react";
import {
  Flame,
  PhoneOutgoing,
  Bell,
  Pencil,
  AlarmClockCheck,
  CircleUser,
  UserRoundCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- Design tokens extracted from Frame 470 (1).svg ---
const C = {
  cardBorder: "#685D5D",
  divider: "#D9D9D9",
  metaText: "#4E4E4E",
  phoneLink: "#0033FF",
  green: "#05FF6A",
  greenText: "#0B5E2A",
  orange: "#E17100",
  iconStroke: "#4E4E4E",
} as const;

// --- Icon components backed by /public/icons assets ---

// WhatsApp brand glyph (Figma "WHATASPP icon need to save as icon")
const WhatsAppIcon: React.FC<{
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}> = ({ className, onClick }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src="/icons/whatsapp-brands-solid-full (2).svg"
    alt=""
    aria-hidden="true"
    onClick={onClick}
    className={cn("h-4 w-4 shrink-0 cursor-pointer", className)}
  />
);

// List Arrow icon (Figma "List Arrow from google icon")
const ListArrowIcon: React.FC<{ className?: string }> = ({ className }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src="/icons/list_arrow_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg"
    alt=""
    aria-hidden="true"
    className={cn("h-4 w-4", className)}
  />
);

// Hot flame icon (Figma "Vector"). The asset already carries the red→orange→
// yellow gradient. Toggled by isHot: gradient flame when true, grey outline
// (muted) when false.
const HotFlameIcon: React.FC<{
  className?: string;
  isHot?: boolean;
}> = ({ className, isHot = false }) =>
  isHot ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icons/Frame.svg"
      alt="Hot lead"
      aria-hidden="true"
      className={cn("h-8 w-8", className)}
    />
  ) : (
    <Flame
      className={cn("h-6 w-6", className)}
      style={{ color: C.iconStroke }}
      strokeWidth={1.75}
    />
  );
export interface LeadCardV2Props {
  clientName: string;
  leadId: string;
  phone: string;
  isHot?: boolean;
  reminderDate?: string | null;
  createdDate?: string | null;
  createdByName?: string;
  onMarkWon?: () => void;
  onSort?: () => void;
  onCall?: () => void;
  onWhatsApp?: () => void;
  onEditReminder?: () => void;
  className?: string;
}

const LeadCardV2: React.FC<LeadCardV2Props> = ({
  clientName,
  leadId,
  phone,
  isHot = false,
  reminderDate = null,
  createdDate = null,
  createdByName = "",
  onMarkWon,
  onSort,
  onCall,
  onWhatsApp,
  onEditReminder,
  className,
}) => {
  return (
    <div
      className={cn(
        "w-full max-w-[828px] rounded-[30px] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.12)] border-2 overflow-hidden select-none",
        className
      )}
      style={{ borderColor: C.cardBorder }}
    >
      {/* ===== HEADER ===== */}
      <div className="relative px-6 pt-6 pb-4">
        <div className="pr-12">
          <h3 className="text-[22px] leading-tight font-extrabold tracking-wide text-black line-clamp-1">
            {clientName}
          </h3>
          <p className="mt-0.5 text-sm font-medium text-black/70">{leadId}</p>
        </div>
        {/* hot flame: gradient asset when hot, grey outline when not */}
        <div className="absolute top-6 right-6 flex h-8 w-8 items-center justify-center">
          <HotFlameIcon isHot={isHot} />
        </div>
      </div>

      {/* divider 1 */}
      <div className="h-px w-full" style={{ backgroundColor: C.divider }} />

      {/* ===== BODY ===== */}
      <div className="grid grid-cols-2 gap-0 px-6 py-4">
        {/* left column */}
        <div className="space-y-3 pr-4">
          <div className="flex items-center gap-2">
            <PhoneOutgoing
              className="h-4 w-4 shrink-0 cursor-pointer"
              style={{ color: C.iconStroke }}
              onClick={(e) => {
                e.stopPropagation();
                onCall?.();
              }}
            />
            <a
              href={`tel:${phone}`}
              className="text-sm font-medium underline"
              style={{ color: C.phoneLink }}
              onClick={(e) => e.stopPropagation()}
            >
              {phone}
            </a>
            <WhatsAppIcon
              className="h-4 w-4 shrink-0 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onWhatsApp?.();
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 shrink-0" style={{ color: C.orange }} />
            <span className="text-sm" style={{ color: C.metaText }}>
              Reminder:&nbsp;{reminderDate ?? "—"}
            </span>
            <Pencil
              className="h-3.5 w-3.5 shrink-0 cursor-pointer"
              style={{ color: C.orange }}
              onClick={(e) => {
                e.stopPropagation();
                onEditReminder?.();
              }}
            />
          </div>
        </div>

        {/* right column */}
        <div className="space-y-3 border-l pl-4" style={{ borderColor: C.divider }}>
          <div className="flex items-center gap-2">
            <AlarmClockCheck className="h-4 w-4 shrink-0" style={{ color: C.iconStroke }} />
            <span className="text-sm" style={{ color: C.metaText }}>
              Created:&nbsp;{createdDate ?? "—"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CircleUser className="h-4 w-4 shrink-0" style={{ color: C.iconStroke }} />
            <span className="text-sm" style={{ color: C.metaText }}>
              By:&nbsp;{createdByName || "—"}
            </span>
          </div>
        </div>
      </div>

      {/* divider 2 */}
      <div className="h-px w-full" style={{ backgroundColor: C.divider }} />

      {/* ===== FOOTER ===== */}
      <div className="flex items-center justify-end gap-3 px-6 py-4">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMarkWon?.();
          }}
          className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold shadow-sm transition-transform hover:scale-[1.02] active:scale-95"
          style={{ backgroundColor: C.green, color: C.greenText }}
        >
          <UserRoundCheck className="h-4 w-4" style={{ color: C.greenText }} />
          Mark As Won
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSort?.();
          }}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border bg-[#E1E1E1] transition-colors hover:bg-[#d4d4d4]"
          style={{ borderColor: C.divider }}
          aria-label="Sort / filter"
        >
          <ListArrowIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default LeadCardV2;
