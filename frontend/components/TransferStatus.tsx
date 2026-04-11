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
    ? "border-emerald-700 bg-emerald-900/30 text-emerald-400"
    : isFailure
      ? "border-red-700 bg-red-900/30 text-red-400"
      : "border-[#1e2d5a] bg-[#0d1326] text-[#9eb3ff]";

  return (
    <section className="w-full rounded-2xl border border-[#29335a] bg-[#121937] p-6 shadow-lg">
      <h2 className="text-base font-semibold text-[#f0f4ff]">Transfer Progress</h2>

      {/* Status banner */}
      <div className={`mt-4 rounded-lg border px-4 py-2.5 text-sm font-semibold tracking-wide ${bannerClasses}`}>
        {isFailure
          ? `Transfer ${TRANSFER_STATUS_LABELS[status].toLowerCase()}.`
          : `Status: ${TRANSFER_STATUS_LABELS[status]}`}
      </div>

      {/* Progress steps */}
      <ol className="mt-4 space-y-1.5">
        {PROGRESS_STEPS.map((step, index) => {
          const stepState = getStepState(step, status);
          const isCurrent = stepState === "current";
          const isDone = stepState === "done";

          return (
            <li
              key={step}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                isCurrent
                  ? "border-[#F7931A]/40 bg-[#F7931A]/10"
                  : isDone
                    ? "border-emerald-800 bg-emerald-900/20"
                    : "border-[#1e2d5a] bg-[#0d1326]"
              }`}
            >
              <span
                className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  isDone
                    ? "bg-emerald-600 text-white"
                    : isCurrent
                      ? "bg-[#F7931A] text-white"
                      : "bg-[#1a2a50] text-[#6b7db3]"
                }`}
                aria-hidden="true"
              >
                {isDone ? "✓" : index + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${
                  isDone ? "text-emerald-400" : isCurrent ? "text-[#f0f4ff]" : "text-[#6b7db3]"
                }`}>
                  {TRANSFER_STATUS_LABELS[step]}
                </p>
                {isCurrent && (
                  <p className="mt-0.5 text-xs text-[#F7931A]">In progress…</p>
                )}
              </div>

              {isCurrent && (
                <svg className="h-4 w-4 shrink-0 animate-spin text-[#F7931A]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              )}
            </li>
          );
        })}
      </ol>

      {/* Failure message */}
      {isFailure && (
        <p className="mt-4 rounded-lg border border-red-800 bg-red-900/20 px-3 py-2 text-sm text-red-400">
          {errorMessage ?? "This transfer did not complete. Please start a new transfer."}
        </p>
      )}
    </section>
  );
}
