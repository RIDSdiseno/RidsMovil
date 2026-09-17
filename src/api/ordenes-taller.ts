import {
    apiRequest,
    getStoredToken
} from './client';

import type {
    Solicitante,
    UploadSignatureResponse,
} from '@/src/types/api';

import {
    File,
} from 'expo-file-system';

import {
    fetch as expoFetch,
} from 'expo/fetch';

import {
    API_URL,
} from './config';

export type PrioridadTaller =
    | 'BAJA'
    | 'NORMAL'
    | 'ALTA';

export type TipoEntidadTaller =
    | 'PERSONA'
    | 'EMPRESA';

export type OrigenEntidadTaller =
    | 'RIDS'
    | 'ECONNET'
    | 'OTRO';

export type EntidadTaller = {
    id: number;

    nombre: string;

    rut: string | null;

    correo: string | null;

    telefono: string | null;

    direccion: string | null;

    tipo: TipoEntidadTaller;

    origen: OrigenEntidadTaller;

    empresaId: number | null;
};

export type ListarEntidadesTallerResponse = {
    entidades:
    EntidadTaller[];
};

export type ListarSolicitantesTallerResponse = {
    solicitantes:
    Solicitante[];
};

export type CrearIngresoTallerPayload = {
    equipoId: number;

    entidadId: number;

    solicitanteFirmanteEntradaId:
    number;

    tipoTrabajo: string;

    descripcion: string;

    prioridad:
    PrioridadTaller;

    incluyeCargador:
    boolean;

    notas?:
    | string
    | null;

    nombreFirmanteEntrada:
    string;

    emailFirmanteEntrada:
    string;

    firmaEntradaUrl:
    string;

    firmaEntradaPublicId:
    string;

    firmaEntradaAt:
    string;
};

export type IngresoTallerCreado = {
    id: number;

    fecha: string;

    tipoTrabajo: string;

    descripcion:
    string | null;

    estado:
    string | null;

    notas:
    string | null;

    area: string;

    prioridad:
    PrioridadTaller;

    entidadId:
    number | null;

    equipoId:
    number | null;

    tecnicoId:
    number | null;

    incluyeCargador:
    boolean;

    fechaIngreso:
    string | null;

    ordenGrupoId:
    number | null;

    numeroOrden:
    string | null;

    destinoEquipo:
    string;

    solicitanteFirmanteEntradaId:
    number | null;

    nombreFirmanteEntrada:
    string | null;

    emailFirmanteEntrada:
    string | null;

    firmaEntradaUrl:
    string | null;

    firmaEntradaPublicId:
    string | null;

    firmaEntradaAt:
    string | null;
};

export type CrearIngresoTallerResponse = {
    ok:
    boolean;

    orden:
    IngresoTallerCreado;

    firmante?: {
        id_solicitante:
        number;

        nombre:
        string;

        email:
        string;
    };

    equipo: {
        id_equipo:
        number;

        marca:
        string;

        modelo:
        string;

        serial:
        string | null;
    };
};

/* =========================================================
   ENTIDADES
========================================================= */

export async function listarEntidadesTaller(
    search?: string,
) {
    const query =
        search?.trim()
            ? `?search=${encodeURIComponent(
                search.trim(),
            )}`
            : '';

    return apiRequest<ListarEntidadesTallerResponse>(
        `/ordenes-taller/entidades${query}`,
    );
}

/* =========================================================
   SOLICITANTES
========================================================= */

export function listarSolicitantesTaller(
    search?: string,
) {
    const query =
        search?.trim()
            ? `?search=${encodeURIComponent(
                search.trim(),
            )}`
            : '';

    return apiRequest<ListarSolicitantesTallerResponse>(
        `/ordenes-taller/solicitantes${query}`,
    );
}

/* =========================================================
   FIRMA ENTRADA
========================================================= */

export function solicitarFirmaEntradaTaller(
    equipoId: number,
) {
    return apiRequest<UploadSignatureResponse>(
        '/ordenes-taller/firma-entrada',
        {
            method:
                'POST',

            body:
                JSON.stringify({
                    equipoId,
                }),
        },
    );
}

/* =========================================================
   CREAR INGRESO
========================================================= */

export async function crearIngresoTaller(
    payload:
        CrearIngresoTallerPayload,
) {
    return apiRequest<CrearIngresoTallerResponse>(
        '/ordenes-taller/ingresos',
        {
            method:
                'POST',

            body:
                JSON.stringify(
                    payload,
                ),
        },
    );
}

export type TallerPdfFile = {
    mimeType:
    string;

    name:
    string;

    uri:
    string;
};

export async function enviarPdfIngresoTaller(
    ordenId: number,
    pdfFile:
        TallerPdfFile,
) {
    const token =
        await getStoredToken();

    const normalizedUri =
        pdfFile.uri.startsWith(
            'file://',
        )
            ? pdfFile.uri
            : `file://${pdfFile.uri}`;

    const file =
        new File(
            normalizedUri,
        );

    if (!file.exists) {
        throw new Error(
            'El comprobante PDF no existe.',
        );
    }

    const formData =
        new FormData();

    formData.append(
        'pdf',
        file,
    );

    const response =
        await expoFetch(
            `${API_URL}/ordenes-taller/${ordenId}/enviar-pdf`,
            {
                method:
                    'POST',

                headers:
                    token
                        ? {
                            Authorization:
                                `Bearer ${token}`,
                        }
                        : undefined,

                body:
                    formData,
            },
        );

    const text =
        await response.text();

    let data:
        | {
            ok?: boolean;
            emailQueued?: boolean;
            recipientEmail?: string;
            ccEmail?: string;
            error?: string;
            message?: string;
        }
        | null =
        null;

    if (text) {
        try {
            data =
                JSON.parse(
                    text,
                );
        } catch {
            throw new Error(
                `La API no respondió JSON (${response.status}).`,
            );
        }
    }

    if (!response.ok) {
        throw new Error(
            data?.error ||
            data?.message ||
            'No se pudo enviar el comprobante.',
        );
    }

    return data;
}