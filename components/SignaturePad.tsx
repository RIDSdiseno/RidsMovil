import {
    forwardRef,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from 'react';

import {
    PanResponder,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import Svg, {
    Polyline,
} from 'react-native-svg';

import {
    captureRef,
} from 'react-native-view-shot';

import {
    AppButton,
} from '@/src/components/AppButton';

import {
    colors,
    shadow,
} from '@/src/theme/colors';

type SignaturePoint = {
    x: number;
    y: number;
};

type SignatureStroke =
    SignaturePoint[];

export type SignaturePadRef = {
    clear: () => void;

    capture: () =>
        Promise<string>;

    hasSignature: () =>
        boolean;
};

type SignaturePadProps = {
    height?: number;

    hint?: string;

    onChange?: (
        hasSignature: boolean,
    ) => void;

    onSigningChange?: (
        signing: boolean,
    ) => void;
};

export const SignaturePad =
    forwardRef<
        SignaturePadRef,
        SignaturePadProps
    >(
        function SignaturePad(
            {
                height = 210,

                hint =
                'Firma dentro del recuadro.',

                onChange,

                onSigningChange,
            },

            ref,
        ) {
            const [
                strokes,
                setStrokes,
            ] =
                useState<
                    SignatureStroke[]
                >([]);

            const [
                width,
                setWidth,
            ] =
                useState(0);

            const signatureRef =
                useRef<View>(
                    null,
                );

            const hasSignature =
                strokes.some(
                    (stroke) =>
                        stroke.length >
                        1,
                );

            function clear() {
                setStrokes([]);

                onChange?.(
                    false,
                );
            }

            async function capture() {
                if (
                    !signatureRef.current
                ) {
                    throw new Error(
                        'No se pudo preparar la firma.',
                    );
                }

                if (
                    !hasSignature
                ) {
                    throw new Error(
                        'La firma está vacía.',
                    );
                }

                const uri =
                    await captureRef(
                        signatureRef,
                        {
                            format:
                                'png',

                            quality:
                                1,

                            result:
                                'tmpfile',
                        },
                    );

                return uri;
            }

            useImperativeHandle(
                ref,
                () => ({
                    clear,

                    capture,

                    hasSignature:
                        () =>
                            hasSignature,
                }),
                [
                    hasSignature,
                ],
            );

            const panResponder =
                useMemo(
                    () =>
                        PanResponder.create({
                            onMoveShouldSetPanResponderCapture:
                                () =>
                                    true,

                            onMoveShouldSetPanResponder:
                                () =>
                                    true,

                            onStartShouldSetPanResponderCapture:
                                () =>
                                    true,

                            onStartShouldSetPanResponder:
                                () =>
                                    true,

                            onPanResponderGrant:
                                (
                                    event,
                                ) => {
                                    onSigningChange?.(
                                        true,
                                    );

                                    const {
                                        locationX,
                                        locationY,
                                    } =
                                        event
                                            .nativeEvent;

                                    setStrokes(
                                        (
                                            current,
                                        ) => [
                                                ...current,

                                                [
                                                    {
                                                        x:
                                                            locationX,

                                                        y:
                                                            locationY,
                                                    },
                                                ],
                                            ],
                                    );
                                },

                            onPanResponderMove:
                                (
                                    event,
                                ) => {
                                    const {
                                        locationX,
                                        locationY,
                                    } =
                                        event
                                            .nativeEvent;

                                    setStrokes(
                                        (
                                            current,
                                        ) => {
                                            if (
                                                !current.length
                                            ) {
                                                return [
                                                    [
                                                        {
                                                            x:
                                                                locationX,

                                                            y:
                                                                locationY,
                                                        },
                                                    ],
                                                ];
                                            }

                                            const next =
                                                [
                                                    ...current,
                                                ];

                                            const last =
                                                next[
                                                next.length -
                                                1
                                                ] ??
                                                [];

                                            next[
                                                next.length -
                                                1
                                            ] =
                                                [
                                                    ...last,

                                                    {
                                                        x:
                                                            locationX,

                                                        y:
                                                            locationY,
                                                    },
                                                ];

                                            return next;
                                        },
                                    );
                                },

                            onPanResponderRelease:
                                () => {
                                    onSigningChange?.(
                                        false,
                                    );

                                    onChange?.(
                                        true,
                                    );
                                },

                            onPanResponderTerminationRequest:
                                () =>
                                    false,

                            onPanResponderTerminate:
                                () => {
                                    onSigningChange?.(
                                        false,
                                    );
                                },
                        }),

                    [
                        onChange,
                        onSigningChange,
                    ],
                );

            return (
                <View>
                    <Text
                        style={
                            styles.hint
                        }
                    >
                        {
                            hint
                        }
                    </Text>

                    <View
                        ref={
                            signatureRef
                        }
                        collapsable={
                            false
                        }
                        onLayout={(
                            event,
                        ) => {
                            setWidth(
                                event
                                    .nativeEvent
                                    .layout
                                    .width,
                            );
                        }}
                        style={[
                            styles.box,

                            {
                                height,
                            },
                        ]}
                        {...panResponder.panHandlers}
                    >
                        <Svg
                            height={
                                height
                            }
                            width={
                                width ||
                                1
                            }
                        >
                            {strokes.map(
                                (
                                    stroke,
                                    index,
                                ) => (
                                    <Polyline
                                        fill="none"
                                        key={`${index}-${stroke.length}`}
                                        points={stroke
                                            .map(
                                                (
                                                    point,
                                                ) =>
                                                    `${point.x},${point.y}`,
                                            )
                                            .join(
                                                ' ',
                                            )}
                                        stroke={
                                            colors.ink
                                        }
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={
                                            3
                                        }
                                    />
                                ),
                            )}
                        </Svg>
                    </View>

                    <AppButton
                        disabled={
                            !hasSignature
                        }
                        onPress={
                            clear
                        }
                        title="Limpiar firma"
                        variant="ghost"
                    />
                </View>
            );
        },
    );

const styles =
    StyleSheet.create({
        hint: {
            color:
                colors.muted,

            fontSize:
                13,

            lineHeight:
                19,

            marginBottom:
                10,
        },

        box: {
            backgroundColor:
                colors.surface,

            borderColor:
                colors.line,

            borderRadius:
                18,

            borderWidth:
                1,

            overflow:
                'hidden',

            ...shadow,
        },
    });