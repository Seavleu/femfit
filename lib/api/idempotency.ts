/**
 * Idempotency-Key implementation.
 *
 * Per API Spec §7.1: "All write endpoints require an Idempotency-Key header."
 * Per Sys Design §9.3: "Store key → response in idempotency_keys table; TTL 24h."
 *
 * Flow:
 *   1. Client sends Idempotency-Key header (UUID v4)
 *   2. Server checks idempotency_keys table for existing entry
 *   3. If found and completed: return cached response (replay)
 *   4. If found and pending: return 409 (concurrent duplicate)
 *   5. If not found: insert pending row, process request, update with response
 *
 * The idempotency_keys table was created in 0001_rls_policies.sql with:
 *   key (PK), user_id, endpoint, response (jsonb), status (int),
 *   created_at, expires_at (default now() + 24h)
 */

import { createServiceRoleClient } from "../supabase/admin";

interface IdempotencyResult<T> {
    /** true if the response was replayed from a previous request */
    replayed: boolean;
    /** The response data */
    data: T;
    /** HTTP status code */
    status: number;
}

export async function withIdempotency<T>(
    key: string,
    userId: string,
    endpoint: string,
    handler:() => Promise<{data: T; status: number}>
): Promise<IdempotencyResult<T>>{
    const admin = createServiceRoleClient();

    const { data: existing } = await admin
    .from("idempotency_keys")
    .select("response, status")
    .eq("key", key)
    .eq("user_id", userId)
    .maybeSingle();

    if (existing) {
        if (existing.status !== null && existing.response !== null) {
            return {
                replayed: true,
                data: existing.response as T,
                status: existing.status,
            }
        }

        throw new IdempotencyConflictError(
            "A request with this Idempotency-key is already being processed."
        )
    }

    const { error: insertErr } = await admin 
    .from("idempotency_keys")
    .insert({
        key,
        user_id: userId,
        endpoint,
        response: null,
        status: null,
    })

    if (insertErr) {
        // Unique constraint violation = concurrent insert with same key

        if (insertErr.code == "23505") {
            throw new IdempotencyConflictError (
                "A request with this Idempotency-key is already being processed."
            )    
        }
        throw insertErr;
    }
    try {
        // 3. Execute the handler
        const result = await handler();

        // 4. Store the result
        await admin
        .from("idempotency_keys")
        .update({
            response: result.data as unknown as Record<string, unknown>,            
            status: result.status,
        })
        .eq("key", key)
        .eq("user_id", userId);

        return { replayed: false, ...result };
    } catch (err) {
        // On failure, delete the pending row so the client can retry

        await admin
        .from("idempotency_keys")
        .delete()
        .eq("key", key)
        .eq("user_id", userId);

        throw err;
    }
}

export class IdempotencyConflictError extends Error {
    constructor(message: string) {
        super(message);
        this.name =  "IdempotencyConflictError"
    }
}
  