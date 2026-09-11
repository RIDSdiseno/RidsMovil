import { invalidateCache } from './cache';
import { apiRequest } from './client';

export type SyncProvider =
    | 'MICROSOFT'
    | 'GOOGLE';

export type SyncSolicitantesPayload = {
    empresaId: number;
    domain: string;
};

export type SyncSolicitantesResponse = {
    ok: boolean;
    domain?: string;
    empresaId?: number;

    total?: number;
    created?: number;
    updated?: number;
    skipped?: number;
    deactivated?: number;

    deactivatedUsers?: unknown[];

    filter?: string | null;

    timings?: {
        graphMs?: number;
        skuMs?: number;
        dbMs?: number;
        skuCountProcessed?: number;
        concurrency?: number;
        chunks?: number;
    };

    error?: string;
};

export async function syncMicrosoftSolicitantes(
    payload: SyncSolicitantesPayload,
) {
    const response =
        await apiRequest<SyncSolicitantesResponse>(
            '/solicitantes-sync/microsoft',
            {
                method: 'POST',
                body: JSON.stringify(payload),
            },
        );

    invalidateCache(
        `solicitantes:${payload.empresaId}`,
    );

    return response;
}

export async function syncGoogleSolicitantes(
    payload: SyncSolicitantesPayload,
) {
    const response =
        await apiRequest<SyncSolicitantesResponse>(
            '/solicitantes-sync/google',
            {
                method: 'POST',
                body: JSON.stringify(payload),
            },
        );

    invalidateCache(
        `solicitantes:${payload.empresaId}`,
    );

    return response;
}