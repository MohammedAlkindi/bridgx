import type { TransferStatus as TransferStatusValue } from "../types";
import { TRANSFER_STATUS_LABELS } from "../types";

type TransferStatusProps = {
  status: TransferStatusValue;
  errorMessage?: string;
};

const PROGRESS_STEPS: TransferStatusValue[] = [
  "CREATED",
  "SOURCE_TX_SUBMITTED",
  "SOURCE_CONFIRMED",
  "ATTESTATION_PENDING",
  "ATTESTATION_READY",
  "DEST_TX_SUBMITTED",
  "COMPLETED",
];

const TERMINAL_FAILURE_STATES: TransferStatusValue[] = ["FAILED", "EXPIRED"];

function getStepState(step: TransferStatusValue, status: TransferStatusValue): "done" | "current" | "todo" {
  const currentIndex = PROGRESS_STEPS.indexOf(status);
  const stepIndex = PROGRESS_STEPS.indexOf(step);

  if (currentIndex === -1) return "todo";
  if (stepIndex < currentIndex) return "done";
  if (stepIndex === currentIndex) return "current";
  return "todo";
}

export default function TransferStatus({ status, errorMessage }: TransferStatusProps) {
  const isSuccess = status === "COMPLETED";
  const isFailure = TERMINAL_FAILURE_STATES.includes(status);

  const bannerClasses = isSuccess
    ? "border-emerald-800/60 bg-emerald-950/40 text-emerald-400"
    : isFailure
      ? "border-red-800/60 bg-red-950/40 text-red-400"
      : "border-[#1a2240] bg-[#090e1f] text-[#7a90b8]";

  return (
    <section className="w-full rounded-2xl border border-[#1e2a4a] bg-[#0f1630] shadow-lg" style={{ overflow: "hidden" }}>
      <div className="px-5 pt-5 pb-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-widest text-[#4a5a8a]">
          Transfer Progress
        </h2>

        {/* Status banner */}
        <div className={`mt-3 rounded-lg border px-4 py-2.5 text-sm font-medium ${bannerClasses}`}>
          {isSuccess
            ? "Transfer complete — funds delivered."
            : isFailure
              ? `Transfer ${TRANSFER_STATUS_LABELS[status].toLowerCase()}.`
              : `${TRANSFER_STATUS_LABELS[status]}…`}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-[#0d1428]" />

      {/* Progress steps */}
      <div className="px-5 py-4">
        <ol className="space-y-1">
          {PROGRESS_STEPS.map((step, index) => {
            const stepState = getStepState(step, status);
            const isCurrent = stepState === "current";
            const isDone = stepState === "done";

            return (
              <li
                key={step}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
                  isCurrent
                    ? "border border-[#F7931A]/25 bg-[#F7931A]/8"
                    : isDone
                      ? "border border-emerald-900/40 bg-emerald-950/20"
                      : "border border-[#0d1428] bg-transparent"
                }`}
                style={isCurrent ? { background: "rgba(247,147,26,0.05)" } : undefined}
              >
                {/* Step indicator */}
                <span
                  className={`inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                    isDone
                      ? "bg-emerald-700/80 text-white"
                      : isCurrent
                        ? "bg-[#F7931A] text-white"
                        : "bg-[#0d1428] text-[#3d5070]"
                  }`}
                  aria-hidden="true"
                >
                  {isDone ? "✓" : index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium leading-tight ${
                    isDone
                      ? "text-emerald-500"
                      : isCurrent
                        ? "text-[#e2e8ff]"
                        : "text-[#3d5070]"
                  }`}>
                    {TRANSFER_STATUS_LABELS[step]}
                  </p>
                  {isCurrent && (
                    <p className="mt-0.5 text-[11px] text-[#F7931A]/70">In progress</p>
                  )}
                </div>

                {isCurrent && (
                  <svg className="h-3.5 w-3.5 shrink-0 animate-spin text-[#F7931A]" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Failure detail */}
      {isFailure && (
        <>
          <div className="border-t border-[#0d1428]" />
          <div className="px-5 py-4">
            <p className="rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2.5 text-sm text-red-400 leading-snug">
              {errorMessage ?? "This transfer did not complete. Please start a new transfer."}
            </p>
          </div>
        </>
      )}
    </section>
  );
}
