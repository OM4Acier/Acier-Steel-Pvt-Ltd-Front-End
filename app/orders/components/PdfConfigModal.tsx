'use client';

/**
 * PdfConfigModal.tsx
 * ──────────────────────────────────────────────────────────────────
 * Super-admin modal to toggle which fields appear in exported PDFs.
 * Config is persisted to localStorage and used by generateOrderPdf.
 */

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Settings2, Save, RotateCcw, FileText } from 'lucide-react';

import {
  PDF_FIELDS,
  PdfFieldConfig,
  PdfFieldVisibilityMap,
  saveSuperAdminPdfConfig,
} from '../pdfConfig';

// ─── Types ───────────────────────────────────────────────────────────

interface PdfConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: PdfFieldVisibilityMap;
  /** Called after saving so parent can refresh its visibilityMap */
  onSaved: (newConfig: PdfFieldVisibilityMap) => void;
  onExport?: (newConfig: PdfFieldVisibilityMap) => void;
}

// ─── Category metadata ────────────────────────────────────────────────

const CATEGORY_META: Record<
  PdfFieldConfig['category'],
  { label: string; color: string; dot: string }
> = {
  client:   { label: 'Client',   color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700',   dot: 'bg-blue-500'   },
  status:   { label: 'Status',   color: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700', dot: 'bg-purple-500' },
  product:  { label: 'Product',  color: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700',  dot: 'bg-green-500'  },
  delivery: { label: 'Delivery', color: 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-700',    dot: 'bg-teal-500'   },
  invoice:  { label: 'Invoice',  color: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700', dot: 'bg-orange-500' },
};

// ─── Component ─────────────────────────────────────────────────────────

export const PdfConfigModal: React.FC<PdfConfigModalProps> = ({
  isOpen,
  onClose,
  currentConfig,
  onSaved,
  onExport,
}) => {
  const [draft, setDraft] = useState<PdfFieldVisibilityMap>({ ...currentConfig });

  // Reset draft when config changes externally
  React.useEffect(() => {
    setDraft({ ...currentConfig });
  }, [currentConfig, isOpen]);

  const toggleField = useCallback((fieldId: string, value: boolean) => {
    setDraft((prev) => ({ ...prev, [fieldId]: value }));
  }, []);

  const handleSave = () => {
    saveSuperAdminPdfConfig(draft);
    onSaved(draft);
    onClose();
  };

  const handleSaveAndExport = () => {
    saveSuperAdminPdfConfig(draft);
    onSaved(draft);
    if (onExport) onExport(draft);
    onClose();
  };

  const handleReset = () => {
    const defaults: PdfFieldVisibilityMap = {};
    PDF_FIELDS.forEach((f) => { defaults[f.id] = f.defaultVisible; });
    setDraft(defaults);
  };

  // Group fields by category
  const grouped = PDF_FIELDS.reduce<Record<string, PdfFieldConfig[]>>((acc, f) => {
    if (!acc[f.category]) acc[f.category] = [];
    acc[f.category].push(f);
    return acc;
  }, {});

  const totalEnabled = Object.values(draft).filter(Boolean).length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden rounded-xl shadow-2xl z-[9100]">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-700 px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <Settings2 className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <DialogHeader className="p-0">
              <DialogTitle className="text-white text-base font-bold">
                PDF Export Configuration
              </DialogTitle>
              <DialogDescription className="text-gray-300 text-xs">
                Choose which fields appear in exported PDFs (super-admin only)
              </DialogDescription>
            </DialogHeader>
          </div>
          <Badge className="ml-auto bg-amber-500/20 text-amber-300 border-amber-600/40 text-xs">
            <FileText className="w-3 h-3 mr-1" />
            {totalEnabled} / {PDF_FIELDS.length} fields
          </Badge>
        </div>

        {/* Field groups */}
        <div className="overflow-y-auto max-h-[54vh] p-5 space-y-4 bg-gray-50 dark:bg-gray-900">
          {(Object.keys(CATEGORY_META) as PdfFieldConfig['category'][]).map((cat) => {
            const fields = grouped[cat];
            if (!fields?.length) return null;

            const meta = CATEGORY_META[cat];

            return (
              <div
                key={cat}
                className={`rounded-lg border p-3 space-y-2 ${meta.color}`}
              >
                {/* Category label */}
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                    {meta.label}
                  </span>
                </div>

                {/* Fields */}
                {fields.map((field) => {
                  const isOn = draft[field.id] ?? field.defaultVisible;
                  return (
                    <div
                      key={field.id}
                      className="flex items-center justify-between py-1.5 px-2 rounded-md bg-white dark:bg-gray-800 shadow-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <Label
                          htmlFor={`pdf-field-${field.id}`}
                          className="text-sm font-medium text-gray-800 dark:text-gray-100 cursor-pointer"
                        >
                          {field.label}
                        </Label>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">
                          Visible to:{' '}
                          {field.visibleForRoles.map((r) =>
                            r === 'super-admin' ? 'Admin' :
                            r.charAt(0).toUpperCase() + r.slice(1)
                          ).join(', ')}
                        </p>
                      </div>
                      <Switch
                        id={`pdf-field-${field.id}`}
                        checked={isOn}
                        onCheckedChange={(v) => toggleField(field.id, v)}
                        className="ml-3"
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <DialogFooter className="px-5 py-3.5 border-t bg-white dark:bg-gray-900 flex justify-between items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-gray-500 gap-1.5 text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to defaults
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSave}
              className="gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              Save
            </Button>
            <Button
              size="sm"
              onClick={handleSaveAndExport}
              className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              Save & Export
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
