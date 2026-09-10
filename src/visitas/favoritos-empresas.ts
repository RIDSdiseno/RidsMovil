import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITOS_KEY =
    'rids.visitas.empresasFavoritas';

export async function getEmpresasFavoritas(): Promise<number[]> {
    try {
        const raw =
            await AsyncStorage.getItem(
                FAVORITOS_KEY,
            );

        if (!raw) {
            return [];
        }

        const parsed =
            JSON.parse(raw);

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .map(Number)
            .filter(
                (id) =>
                    Number.isInteger(id) &&
                    id > 0,
            );
    } catch {
        return [];
    }
}

export async function toggleEmpresaFavorita(
    empresaId: number,
): Promise<number[]> {
    const actuales =
        await getEmpresasFavoritas();

    const existe =
        actuales.includes(
            empresaId,
        );

    const nuevos =
        existe
            ? actuales.filter(
                (id) =>
                    id !== empresaId,
            )
            : [
                ...actuales,
                empresaId,
            ];

    await AsyncStorage.setItem(
        FAVORITOS_KEY,
        JSON.stringify(nuevos),
    );

    return nuevos;
}