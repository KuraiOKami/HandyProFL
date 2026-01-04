import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "auth.missing"
  | "auth.forbidden"
  | "auth.not_agent"
  | "auth.not_admin"
  | "request.not_found"
  | "request.invalid"
  | "request.conflict"
  | "storage.upload_failed"
  | "proof.duplicate"
  | "job.not_found"
  | "job.not_assigned"
  | "job.invalid_status"
  | "gig.unavailable"
  | "payment.failed"
  | "internal.error"
  | "service.unconfigured";

type ErrorPayload = {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
};

export function errorResponse(code: ApiErrorCode, message: string, status = 400, details?: Record<string, unknown>) {
  const payload: ErrorPayload = { error: { code, message } };
  if (details) payload.error.details = details;
  return NextResponse.json(payload, { status });
}
