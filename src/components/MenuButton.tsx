import { Pressable, StyleSheet, Text, View } from "react-native";
import { gameTheme } from "../theme/gameTheme";

type MenuButtonProps = {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  size?: "large" | "small";
  subtitle?: string;
  variant?: "primary" | "secondary";
};

export function MenuButton({
  disabled = false,
  label,
  onPress,
  size = "large",
  subtitle,
  variant = "primary",
}: MenuButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        size === "small" ? styles.smallButton : styles.largeButton,
        variant === "secondary" ? styles.secondary : styles.primary,
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <View style={styles.goldLine} />
      <Text style={[styles.label, size === "small" ? styles.smallLabel : null]}>{label}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: "rgba(9, 13, 25, 0.76)",
    borderColor: gameTheme.colors.gold,
    borderWidth: 1.5,
    justifyContent: "center",
    overflow: "hidden",
    ...gameTheme.shadow,
  },
  disabled: {
    borderColor: "rgba(216, 168, 79, 0.28)",
    opacity: 0.48,
  },
  goldLine: {
    backgroundColor: "rgba(243, 213, 138, 0.72)",
    height: 1,
    left: 18,
    position: "absolute",
    right: 18,
    top: 5,
  },
  label: {
    color: gameTheme.colors.cream,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0,
    textAlign: "center",
  },
  largeButton: {
    borderRadius: gameTheme.radius.xl,
    minHeight: 76,
    paddingHorizontal: 26,
    paddingVertical: 14,
    width: "100%",
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  primary: {
    backgroundColor: "rgba(42, 25, 71, 0.82)",
    borderColor: gameTheme.colors.goldLight,
  },
  secondary: {
    backgroundColor: "rgba(9, 20, 42, 0.74)",
  },
  smallButton: {
    borderRadius: gameTheme.radius.lg,
    flex: 1,
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  smallLabel: {
    fontSize: 17,
  },
  subtitle: {
    color: "rgba(255, 244, 214, 0.76)",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
    textAlign: "center",
  },
});
