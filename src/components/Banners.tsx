"use client";

import { useState } from "react";
import type { TabError, Warning } from "@/lib/types";

/**
 * Tab-level failures. These are the ones a staff member must go and fix, so
 * each names its tab and what is wrong with it, and they are not dismissible.
 */
export function ErrorBanner({ errors }: { errors: TabError[] }) {
  if (errors.length === 0) return null;

  return (
    <div
      role="alert"
      className="panel border-danger/40 bg-danger/10 px-4 py-3 text-sm"
    >
      <p className="font-semibold text-danger">
        {errors.length === 1
          ? "A sheet tab could not be read"
          : `${errors.length} sheet tabs could not be read`}
      </p>
      <ul className="mt-2 space-y-1.5 text-parchment-dim">
        {errors.map((error) => (
          <li key={`${error.tab}-${error.problem}`}>
            <span className="font-mono text-xs text-parchment">
              {error.tab}
            </span>{" "}
            — {error.problem}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-parchment-faint">
        The standings below are the last good data.
      </p>
    </div>
  );
}

const KIND_LABELS: Record<string, string> = {
  unknownPlayer: "Unrecognised player",
  unknownItem: "Unrecognised item",
  unknownTeam: "Unrecognised team",
  bossNotInCatalog: "Unrecognised boss",
  bonusCategoryInDrops: "Bonus row in the drop log",
  incompleteRow: "Incomplete row",
  teamMismatch: "Team mismatch",
  catalogRowSkipped: "Catalog row skipped",
  catalogDuplicate: "Duplicate catalog row",
  catalogKeyMismatch: "Catalog key mismatch",
  unparsedNumber: "Unreadable number",
  pendingPrice: "Price still calculating",
  unknownBonusType: "Unrecognised bonus type",
  rosterAmbiguousAlias: "Ambiguous roster name",
};

/**
 * Row-level problems: everything the scorer skipped or had to make a call on.
 * Collapsed by default so it does not dominate the page, dismissible so it can
 * be got rid of once someone has read it.
 */
export function WarningsPanel({ warnings }: { warnings: Warning[] }) {
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);

  if (warnings.length === 0 || dismissed) return null;

  return (
    <div className="panel border-warn/30 bg-warn/5 px-4 py-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 items-center gap-2 text-left"
          aria-expanded={open}
        >
          <span
            aria-hidden
            className={`text-parchment-faint transition-transform ${open ? "rotate-90" : ""}`}
          >
            ▸
          </span>
          <span className="font-semibold text-warn">
            {warnings.length} row{warnings.length === 1 ? "" : "s"} need
            attention
          </span>
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 text-xs text-parchment-faint hover:text-parchment"
        >
          Dismiss
        </button>
      </div>

      {open && (
        <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
          {warnings.map((warning, index) => (
            <li
              key={`${warning.kind}-${warning.tab}-${warning.row ?? index}-${index}`}
              className="border-l-2 border-warn/30 pl-3"
            >
              <div className="text-xs text-parchment-faint">
                {KIND_LABELS[warning.kind] ?? warning.kind} ·{" "}
                <span className="font-mono">{warning.tab}</span>
                {warning.row !== undefined && ` row ${warning.row}`}
              </div>
              <div className="text-parchment-dim">{warning.message}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
