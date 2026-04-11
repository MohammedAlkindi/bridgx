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

  if (currentIndex === -1) {
    return "todo";
  }

  if (stepIndex < currentIndex) {
    return "done";
  }

  if (stepIndex === currentIndex) {
    return "current";
  }

  return "todo";
}

export default function TransferStatus({ status, errorMessage }: TransferStatusProps) {
  const isSuccess = status === "COMPLETED";
  const isFailure = TERMINAL_FAILURE_STATES.includes(status);

  const bannerTone = isSuccess
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : isFailure
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-neutral-200 bg-neutral-50 text-neutral-700";

  return (
    <section className="w-full max-w-xl rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-neutral-900">Transfer progress</h2>
      <p className="mt-1 text-sm text-neutral-600">Track each bridge step from source submission to destination finalization.</p>

      <div className={`mt-4 rounded-lg border px-3 py-2 text-sm font-medium ${bannerTone}`}>
        {isFailure ? `Transfer ${TRANSFER_STATUS_LABELS[status].toLowerCase()}.` : `Current status: ${TRANSFER_STATUS_LABELS[status]}`}
      </div>

      <ol className="mt-4 space-y-2">
        {PROGRESS_STEPS.map((step, index) => {
          const stepState = getStepState(step, status);
          const isCurrent = stepState === "current";
          const isDone = stepState === "done";

          return (
            <li
              key={step}
              className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${
                isCurrent
                  ? "border-[#F7931A]/50 bg-[#F7931A]/10"
                  : isDone
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-neutral-200 bg-white"
              }`}
            >
              <span
                className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  isDone ? "bg-emerald-500 text-white" : isCurrent ? "bg-[#F7931A] text-white" : "bg-neutral-200 text-neutral-600"
                }`}
                aria-hidden="true"
              >
                {isDone ? "✓" : index + 1}
              </span>

              <div className="min-w-0">
                <p className={`text-sm font-medium ${isCurrent ? "text-neutral-900" : "text-neutral-700"}`}>
                  {TRANSFER_STATUS_LABELS[step]}
                </p>
                {isCurrent ? <p className="text-xs text-neutral-600">In progress</p> : null}
              </div>
            </li>
          );
        })}
      </ol>

      {isFailure ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage ?? "This transfer did not complete. Please retry with a new quote."}
        </p>
      ) : null}
    </section>
  );
}
