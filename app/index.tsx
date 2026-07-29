import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import * as AuthSession from "expo-auth-session";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth/AuthContext";
import { AppButton } from "@/src/components/AppButton";
import { TextInput } from "@/src/components/AppTextInput";
import { colors, shadow } from "@/src/theme/colors";

WebBrowser.maybeCompleteAuthSession();

const microsoftClientId = process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID ?? "";
const microsoftTenantId = process.env.EXPO_PUBLIC_MICROSOFT_TENANT_ID ?? "common";
const microsoftRedirectUri = AuthSession.makeRedirectUri({
  path: "auth",
  scheme: "ridsmovilexpo",
});

export default function LoginScreen() {
  const { isLoading, signIn, signInMicrosoft } = useAuth();
  const backgroundPlayer = useVideoPlayer(
    require("@/assets/videos/video_rids.mp4"),
    (player) => {
      player.loop = false;
      player.muted = true;
      player.play();
    },
  );
  const loopFadeOpacity = useRef(new Animated.Value(0)).current;
  const isLoopTransitioning = useRef(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittingMicrosoft, setSubmittingMicrosoft] = useState(false);
  const microsoftDiscovery = AuthSession.useAutoDiscovery(
    `https://login.microsoftonline.com/${microsoftTenantId}/v2.0`,
  );
  const [microsoftRequest, , promptMicrosoftAsync] = AuthSession.useAuthRequest(
    {
      clientId: microsoftClientId,
      prompt: AuthSession.Prompt.SelectAccount,
      redirectUri: microsoftRedirectUri,
      responseType: AuthSession.ResponseType.Code,
      scopes: ["openid", "profile", "email"],
      usePKCE: true,
    },
    microsoftDiscovery,
  );

  useEffect(() => {
    let mounted = true;

    try {
      backgroundPlayer.timeUpdateEventInterval = 0.25;
    } catch {
      return () => {
        mounted = false;
      };
    }

    const resetVideoWithFade = () => {
      if (!mounted || isLoopTransitioning.current) {
        return;
      }

      isLoopTransitioning.current = true;
      Animated.timing(loopFadeOpacity, {
        duration: 420,
        toValue: 0.72,
        useNativeDriver: true,
      }).start(() => {
        if (!mounted) {
          isLoopTransitioning.current = false;
          return;
        }

        try {
          backgroundPlayer.currentTime = 0;
          backgroundPlayer.play();
        } catch {
          isLoopTransitioning.current = false;
          return;
        }

        Animated.timing(loopFadeOpacity, {
          duration: 520,
          toValue: 0,
          useNativeDriver: true,
        }).start(() => {
          if (!mounted) return;
          isLoopTransitioning.current = false;
        });
      });
    };

    const timeUpdateSubscription = backgroundPlayer.addListener(
      "timeUpdate",
      ({ currentTime }) => {
        const duration = backgroundPlayer.duration;

        if (duration > 1 && duration - currentTime <= 0.55) {
          resetVideoWithFade();
        }
      },
    );
    const playToEndSubscription = backgroundPlayer.addListener(
      "playToEnd",
      resetVideoWithFade,
    );

    return () => {
      mounted = false;
      loopFadeOpacity.stopAnimation();
      isLoopTransitioning.current = false;
      timeUpdateSubscription.remove();
      playToEndSubscription.remove();
    };
  }, [backgroundPlayer, loopFadeOpacity]);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError("Ingresa usuario y contrasena.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await signIn(email, password);
    } catch {
      setError("Credenciales invalidas.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMicrosoftLogin() {
    if (!microsoftClientId) {
      setError("Configura EXPO_PUBLIC_MICROSOFT_CLIENT_ID para usar Microsoft.");
      return;
    }

    if (!microsoftDiscovery || !microsoftRequest) {
      setError("Microsoft aun se esta preparando. Intenta nuevamente.");
      return;
    }

    try {
      setSubmittingMicrosoft(true);
      setError("");

      const result = await promptMicrosoftAsync();

      if (result.type !== "success") {
        return;
      }

      const code = result.params.code;
      const codeVerifier = microsoftRequest.codeVerifier;

      if (!code || !codeVerifier) {
        throw new Error("Microsoft no entrego el codigo de autenticacion.");
      }

      const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
          clientId: microsoftClientId,
          code,
          extraParams: { code_verifier: codeVerifier },
          redirectUri: microsoftRedirectUri,
        },
        microsoftDiscovery,
      );

      if (!tokenResponse.idToken) {
        throw new Error("Microsoft no entrego id_token.");
      }

      await signInMicrosoft(tokenResponse.idToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesion con Microsoft.");
    } finally {
      setSubmittingMicrosoft(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View pointerEvents="none" style={styles.videoLayer}>
        <VideoView
          contentFit="cover"
          nativeControls={false}
          player={backgroundPlayer}
          style={styles.video}
        />
        <View style={styles.videoOverlay} />
        <Animated.View
          style={[styles.loopFadeOverlay, { opacity: loopFadeOpacity }]}
        />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboard}
      >
        <View style={styles.content}>
          <View style={styles.hero}>
            <View style={styles.logoBadge}>
              <Image
                source={require("@/assets/images/logo_rids_blanco.png")}
                style={styles.logo}
                contentFit="contain"
              />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>RIDS MOVIL</Text>
            <Text style={styles.cardTitle}>Iniciar sesion</Text>
            <Text style={styles.cardSubtitle}>
              Accede con tu cuenta corporativa Microsoft o con tus credenciales
              RIDS
            </Text>

            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="Correo"
              placeholderTextColor="#5F6673"
              style={styles.input}
              value={email}
            />

            <View style={styles.passwordField}>
              <TextInput
                onChangeText={setPassword}
                placeholder="Contrasena"
                placeholderTextColor="#5F6673"
                secureTextEntry={!showPassword}
                style={styles.passwordInput}
                value={password}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowPassword((visible) => !visible)}
                style={styles.eyeButton}
              >
                <Ionicons
                  color="#55505C"
                  name={showPassword ? "eye-off" : "eye"}
                  size={28}
                />
              </Pressable>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <AppButton
              disabled={isLoading}
              loading={submitting}
              onPress={handleLogin}
              style={styles.button}
              title="Ingresar"
            />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>o</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={submittingMicrosoft}
              onPress={handleMicrosoftLogin}
              style={({ pressed }) => [
                styles.microsoftButton,
                submittingMicrosoft && styles.disabledButton,
                pressed && !submittingMicrosoft && styles.microsoftButtonPressed,
              ]}
            >
              <FontAwesome5 color={colors.white} name="windows" size={18} />
              <Text style={styles.microsoftButtonText}>
                {submittingMicrosoft ? "Conectando..." : "Continuar con Microsoft"}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.brandDark,
    flex: 1,
    overflow: "hidden",
  },
  videoLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  video: {
    height: "100%",
    width: "100%",
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(7, 29, 53, 0.58)",
  },
  loopFadeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.navy,
  },
  keyboard: {
    flex: 1,
    padding: 22,
  },
  content: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: Platform.select({ ios: 70, default: 22 }),
  },
  hero: {
    alignItems: "center",
    marginBottom: Platform.select({ android: 56, ios: 52, default: 94 }),
  },
  logoBadge: {
    alignItems: "center",
    height: 150,
    justifyContent: "center",
    width: 310,
  },
  logo: {
    height: 242,
    width: 342,
  },
  card: {
    alignSelf: "center",
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderRadius: 24,
    maxWidth: 420,
    padding: 16,
    paddingBottom: 22,
    paddingTop: 22,
    width: "100%",
    ...shadow,
  },
  cardEyebrow: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 8,
    textAlign: "center",
  },
  cardTitle: {
    color: colors.navy,
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
  },
  cardSubtitle: {
    color: "#4B5D76",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
    marginTop: 10,
    textAlign: "center",
  },
  input: {
    backgroundColor: colors.white,
    borderColor: "#C8D6E6",
    borderRadius: 16,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 17,
    height: 54,
    marginBottom: 14,
    paddingHorizontal: 16,
  },
  passwordField: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "#C8D6E6",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    height: 54,
  },
  passwordInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 17,
    height: "100%",
    paddingLeft: 16,
    paddingRight: 8,
  },
  eyeButton: {
    alignItems: "center",
    height: "100%",
    justifyContent: "center",
    width: 52,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 12,
  },
  button: {
    backgroundColor: colors.brand,
    borderRadius: 16,
    marginTop: 10,
  },
  divider: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    marginVertical: 16,
  },
  dividerLine: {
    backgroundColor: colors.line,
    flex: 1,
    height: 1,
  },
  dividerText: {
    color: "#708199",
    fontSize: 16,
    fontWeight: "900",
  },
  microsoftButton: {
    alignItems: "center",
    backgroundColor: colors.navy,
    borderRadius: 16,
    flexDirection: "row",
    gap: 14,
    height: 54,
    justifyContent: "center",
  },
  microsoftButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  disabledButton: {
    opacity: 0.58,
  },
  microsoftButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "900",
  },
});
