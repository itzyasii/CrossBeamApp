import { TransferJob, TransferStatus } from "@/types/domain";

const labels: Record<TransferStatus, string> = {
  blocked: "Needs attention",
  queued: "Getting ready",
  "in-progress": "Sending",
  paused: "Paused",
  completed: "Done",
  failed: "Couldn't send",
  cancelled: "Cancelled",
  rejected: "Declined",
};

export const transferStatusLabel = (status: TransferStatus): string =>
  labels[status];

export const transferRouteLabel = (job: TransferJob): string => {
  if (job.fromDeviceName === "This Device") return `Sent to ${job.toDeviceName}`;
  if (job.toDeviceName === "This Device") return `Received from ${job.fromDeviceName}`;
  return `${job.fromDeviceName} → ${job.toDeviceName}`;
};
