/**
 * RFC 7807 Problem Details for HTTP APIs.
 *
 * Per API Spec §7.1: "All error responses use application/problem+json."
 *
 * @see https://www.rfc-editor.org/rfc/rfc7807
 */

import { forbidden, notFound, unauthorized } from "next/navigation";

export interface ProblemDetail {
    /** URI reference identifying the problem type
*/
    type: string;
    title: string;
    status: number;
    detail?: string;
    instance?: string;
    [key: string]: unknown;
}

export function problem (
    status: number,
    type: string,
    title: string,
    detail?: string,
    extra?: Record<string, unknown>
): ProblemDetail {
    return {
        type: `https://femfit.com/problems/${type}`,
        title,
        status,
        ...(detail ? { detail } : {}),
        ...extra,
    }
}


// Common problems
export const PROBLEMS = {
    validation: (detail: string, errors?: unknown) => 
        problem(400, "Validation-error", "Validation failed", detail, { errors }),

    notFound: (detail: string) => 
        problem(404, "not-found", "Not found", detail),

    conflict: (detail: string) => 
        problem(409, "conflict", "Conflict", detail),

    insufficientStock: (sku: string, available: number) => 
        problem(
            409,
            "insufficient-stock",
            "Insufficient stock",
            `SKU ${sku} has only ${available} units available.`,
            { sku, available }
        ),

        idempotencyReplay: () => 
            problem(
                409,
                "idempotency-replay",
                "Duplicate request",
                "This request has already has been processed. The original response is returned",
            ),
        
        unauthorized: (detail?: string) => 
            problem(
                401,
                "unauthorized",
                "Authentication required",
                detail
            ),

        forbidden: (detail?: string) => 
            problem(
                403,
                "forbidden",
                "Forbidden",
                detail
            ),

        serverError: (detail?: string) => 
            problem(
                500, "server-error",
                "Internal server error", detail
            )
} as const;