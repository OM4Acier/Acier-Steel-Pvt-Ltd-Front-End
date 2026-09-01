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
 * Gap-report fixes applied (see gap-report-leadcardv2.md):
 *   G-01  hot state now syncs to isHot prop changes (semi-controlled)
 *   G-02  onMarkWon is async-aware: loading state, success celebration, error revert
 *   G-03  onToggleHot is async-aware: optimistic update with rollback on rejection
 *   G-04  Call / WhatsApp icons get hover/active affordance
 *   G-05  Dropdown open/close animation
 *   G-06  Flame toggle crossfade + pop animation (Framer Motion)
 *   G-07  Unparseable dates fail closed to "—" instead of showing raw garbage
 *   G-08  (left to parent list — see note in gap report; not a card-level concern)
 *   G-09  Mark As Won is disabled + spinner while submitting (prevents double-fire)
 *   G-10  Card-level hover lift (card is intended to become clickable -> lead detail)
 *   G-11  Dropdown items get icon hover color-shift
 *   G-12  (left as documented trade-off, no code change — see gap report)
 *   G-13  aria-labels added to Call / WhatsApp icon buttons
 *   G-14  all new motion gated behind prefers-reduced-motion
 *
 * New: "Mark As Won" success triggers a short confetti/celebration burst.
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

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Flame,
  PhoneOutgoing,
  Bell,
  Pencil,
  AlarmClockCheck,
  CircleUser,
  UserRoundCheck,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, parseISO, isValid } from "date-fns";

// --- Design tokens extracted from Frame 470 (1).svg ---
const C = {
  cardBorder: "#685D5D",
  divider: "#D9D9D9",
  metaText: "#4E4E4E",
  phoneLink: "#0033FF",
  green: "#05FF6A",
  greenText: "#000000",
  iconStroke: "#4E4E4E",
} as const;

// G-07: unparseable dates fail closed to "—" instead of rendering a raw,
// possibly-garbage string. Logs a dev-only warning to surface bad data early.
const formatDate = (value?: string | null): string => {
  if (!value) return "—";
  const d = parseISO(value);
  if (!isValid(d)) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(`[LeadCardV2] Unparseable date value received: "${value}"`);
    }
    return "—";
  }
  return format(d, "dd MMM yyyy");
};

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
    className={cn("h-4 w-4 shrink-0", className)}
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
// (muted) when false. G-06: crossfade + pop handled by the AnimatePresence
// wrapper in the parent, not here — this stays a dumb render.
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

// --- G-new: lightweight celebration burst for Mark As Won ---
// Pure CSS-timed particles via Framer Motion, no external confetti dependency
// (keeps this component's dependency footprint unchanged). Self-cleans after
// the animation completes. Respects prefers-reduced-motion (skips entirely).
const PARTICLE_COLORS = ["#05FF6A", "#FFD84D", "#4DA3FF", "#FF6B6B", "#B084FF"];

const CelebrationBurst: React.FC<{ trigger: number }> = ({ trigger }) => {
  const shouldReduceMotion = useReducedMotion();
  if (trigger === 0 || shouldReduceMotion) return null;

  const particles = Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
    const distance = 40 + Math.random() * 30;
    return {
      id: `${trigger}-${i}`,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance - 10,
      color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
      size: 5 + Math.random() * 4,
      delay: Math.random() * 0.05,
    };
  });

  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-end overflow-visible"
      aria-hidden="true"
    >
      <div className="relative mr-16">
        {particles.map((p) => (
          <motion.span
            key={p.id}
            className="absolute rounded-full"
            style={{
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              left: 0,
              top: 0,
            }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
            animate={{ x: p.x, y: p.y, opacity: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: p.delay, ease: "easeOut" }}
          />
        ))}
      </div>
    </div>
  );
};

export interface LeadCardV2Props {
  clientName: string;
  leadId: string;
  phone: string;
  isHot?: boolean;
  reminderDate?: string | null;
  createdDate?: string | null;
  createdByName?: string;
  /** G-02: may return a Promise. Rejecting keeps the button state reverted and surfaces the error via console (parent should also toast). */
  onMarkWon?: () => void | Promise<void>;
  onSort?: () => void;
  onCall?: () => void;
  onWhatsApp?: () => void;
  onEditReminder?: () => void;
  /** G-03: may return a Promise; a thrown/rejected call rolls back the flame state. */
  onToggleHot?: (next: boolean) => void | Promise<void>;
  /** Reserved for future lead-detail navigation (G-10). */
  onOpenDetail?: () => void;
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
  onToggleHot,
  onOpenDetail,
  className,
}) => {
  const shouldReduceMotion = useReducedMotion();

  // G-01: local hot state, but re-synced whenever the isHot prop changes
  // (e.g. after a real API refetch updates the parent's source of truth).
  const [hot, setHot] = useState<boolean>(isHot);
  useEffect(() => {
    setHot(isHot);
  }, [isHot]);

  const [hotPending, setHotPending] = useState(false);

  // G-03: optimistic toggle with rollback on failure.
  const toggleHot = async () => {
    if (hotPending) return;
    const previous = hot;
    const next = !hot;
    setHot(next);
    if (!onToggleHot) return;
    setHotPending(true);
    try {
      await onToggleHot(next);
    } catch (err) {
      setHot(previous); // rollback
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.error("[LeadCardV2] onToggleHot failed, reverted:", err);
      }
    } finally {
      setHotPending(false);
    }
  };

  // G-02 / G-09: Mark As Won loading + disabled + celebration-on-success.
  const [isMarkingWon, setIsMarkingWon] = useState(false);
  const [markWonError, setMarkWonError] = useState(false);
  const [celebrationTick, setCelebrationTick] = useState(0);
  const celebrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current);
    };
  }, []);

  const handleMarkWon = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMarkingWon) return;
    setIsMarkingWon(true);
    setMarkWonError(false);
    try {
      await onMarkWon?.();
      setCelebrationTick((t) => t + 1);
      if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current);
      celebrationTimeoutRef.current = setTimeout(() => setCelebrationTick(0), 900);
    } catch (err) {
      setMarkWonError(true);
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.error("[LeadCardV2] onMarkWon failed:", err);
      }
      setTimeout(() => setMarkWonError(false), 2000);
    } finally {
      setIsMarkingWon(false);
    }
  };

  return (
    <motion.div
      className={cn(
        "relative w-full max-w-[828px] rounded-[30px] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.12)] border-2 overflow-visible select-none",
        onOpenDetail && "cursor-pointer",
        className
      )}
      style={{ borderColor: C.cardBorder }}
      onClick={onOpenDetail}
      // G-10: hover lift, only meaningful because this card is intended to
      // open a lead-detail view later. Gated by prefers-reduced-motion.
      whileHover={
        !shouldReduceMotion
          ? { y: -3, boxShadow: "0 8px 32px rgba(0,0,0,0.16)" }
          : undefined
      }
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <div className="rounded-[28px] overflow-hidden">
        {/* ===== HEADER ===== */}
        <div className="relative px-6 pt-6 pb-4">
          <div className="pr-12">
            <h3 className="text-2xl leading-tight font-extrabold tracking-wide text-black line-clamp-1">
              {clientName}
            </h3>
            <p className="mt-0.5 text-md font-normal text-black/70">{leadId}</p>
          </div>
          {/* G-06: flame crossfade + pop on state change */}
          <div className="absolute top-6 right-6 flex h-8 w-8 items-center justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleHot();
              }}
              disabled={hotPending}
              aria-label={hot ? "Remove hot lead" : "Mark as hot lead"}
              aria-pressed={hot}
              className="flex h-8 w-8 items-center justify-center rounded-full outline-none disabled:opacity-60"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={hot ? "hot" : "cold"}
                  initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="flex h-8 w-8 items-center justify-center"
                >
                  <HotFlameIcon isHot={hot} />
                </motion.span>
              </AnimatePresence>
            </button>
          </div>
        </div>

        {/* divider 1 */}
        <div className="h-px w-full" style={{ backgroundColor: C.divider }} />

        {/* ===== BODY ===== */}
        <div className="grid grid-cols-2 gap-0 px-6 py-4">
          {/* left column */}
          <div className="space-y-3 pr-4">
            <div className="flex items-center gap-2">
              {/* G-04 / G-13: hover affordance + aria-label */}
              <button
                type="button"
                aria-label={`Call ${phone}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onCall?.();
                }}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-transform motion-safe:hover:scale-110 motion-safe:active:scale-95 hover:bg-black/5"
              >
                <PhoneOutgoing className="h-4 w-4" style={{ color: C.iconStroke }} />
              </button>
              <a
                href={`tel:${phone}`}
                className="text-sm font-bold underline"
                style={{ color: C.phoneLink }}
                onClick={(e) => e.stopPropagation()}
              >
                {phone}
              </a>
              <span className="h-5 w-px shrink-0" style={{ backgroundColor: C.divider }} />
              <button
                type="button"
                aria-label={`WhatsApp ${phone}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onWhatsApp?.();
                }}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-transform motion-safe:hover:scale-110 motion-safe:active:scale-95 hover:bg-black/5"
              >
                <WhatsAppIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 shrink-0" style={{ color: C.iconStroke }} />
              <span className="text-sm font-bold" style={{ color: C.metaText }}>
                Reminder:&nbsp;{formatDate(reminderDate)}
              </span>
              <Pencil
                className="h-3.5 w-3.5 shrink-0 cursor-pointer transition-transform motion-safe:hover:scale-110"
                style={{ color: C.iconStroke }}
                onClick={(e) => {
                  e.stopPropagation();
                  onEditReminder?.();
                }}
              />
            </div>
          </div>

          {/* right column */}
          <div className="space-y-3 pl-4">
            <div className="flex items-center gap-2">
              <AlarmClockCheck className="h-4 w-4 shrink-0" style={{ color: C.iconStroke }} />
              <span className="text-sm font-bold" style={{ color: C.metaText }}>
                Created:&nbsp;{formatDate(createdDate)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CircleUser className="h-4 w-4 shrink-0" style={{ color: C.iconStroke }} />
              <span className="text-sm font-bold" style={{ color: C.metaText }}>
                By:&nbsp;{createdByName || "—"}
              </span>
            </div>
          </div>
        </div>

        {/* divider 2 */}
        <div className="h-px w-full" style={{ backgroundColor: C.divider }} />

        {/* ===== FOOTER ===== */}
        <div className="relative flex items-center justify-end gap-3 px-6 py-4">
          <CelebrationBurst trigger={celebrationTick} />

          <motion.button
            type="button"
            onClick={handleMarkWon}
            disabled={isMarkingWon}
            whileTap={!shouldReduceMotion ? { scale: 0.95 } : undefined}
            animate={
              markWonError && !shouldReduceMotion
                ? { x: [0, -6, 6, -6, 6, 0] }
                : celebrationTick > 0 && !shouldReduceMotion
                ? { scale: [1, 1.08, 1] }
                : { scale: 1 }
            }
            transition={{ duration: markWonError ? 0.4 : 0.35, ease: "easeOut" }}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-80",
              markWonError && "ring-2 ring-red-500"
            )}
            style={{ backgroundColor: C.green, color: C.greenText }}
          >
            {isMarkingWon ? (
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: C.greenText }} />
            ) : (
              <UserRoundCheck className="h-4 w-4" style={{ color: C.greenText }} />
            )}
            {isMarkingWon ? "Marking…" : markWonError ? "Failed — Retry" : "Mark As Won"}
          </motion.button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSort?.();
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border bg-[#E1E1E1] transition-colors hover:bg-[#d4d4d4]"
                style={{ borderColor: C.divider }}
                aria-label="Actions"
              >
                <ListArrowIcon className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            {/* G-05: open/close animation via Radix state-driven Tailwind classes */}
            <DropdownMenuContent
              align="end"
              onClick={(e) => e.stopPropagation()}
              className="motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 motion-safe:data-[state=open]:zoom-in-95 motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0 motion-safe:data-[state=closed]:zoom-out-95 duration-150"
            >
              <DropdownMenuItem
                className="group"
                onSelect={(e) => {
                  e.preventDefault();
                  handleMarkWon(e as unknown as React.MouseEvent);
                }}
              >
                <UserRoundCheck className="mr-2 h-4 w-4 text-green-600 transition-colors group-hover:text-green-500" />
                Mark As Won
              </DropdownMenuItem>
              <DropdownMenuItem
                className="group"
                onSelect={(e) => {
                  e.preventDefault();
                  onCall?.();
                }}
              >
                <PhoneOutgoing className="mr-2 h-4 w-4 text-blue-500 transition-colors group-hover:text-blue-400" />
                Call
              </DropdownMenuItem>
              <DropdownMenuItem
                className="group"
                onSelect={(e) => {
                  e.preventDefault();
                  onWhatsApp?.();
                }}
              >
                <WhatsAppIcon className="mr-2 h-4 w-4" />
                WhatsApp
              </DropdownMenuItem>
              <DropdownMenuItem
                className="group"
                onSelect={(e) => {
                  e.preventDefault();
                  onEditReminder?.();
                }}
              >
                <Pencil className="mr-2 h-4 w-4 text-orange-500 transition-colors group-hover:text-orange-400" />
                Edit Reminder
              </DropdownMenuItem>
              <DropdownMenuItem
                className="group"
                onSelect={(e) => {
                  e.preventDefault();
                  toggleHot();
                }}
              >
                <Flame className="mr-2 h-4 w-4 text-red-500 transition-colors group-hover:text-red-400" />
                {hot ? "Remove Hot" : "Mark as Hot"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.div>
  );
};

export default LeadCardV2;