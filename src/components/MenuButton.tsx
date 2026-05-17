import type { ImageSourcePropType } from "react-native";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { gameTheme } from "../theme/gameTheme";

type MenuButtonProps = {
  disabled?: boolean;
  iconLabel?: string;
  iconSource?: ImageSourcePropType;
  label: string;
  onPress: () => void;
  size?: "large" | "small";
  subtitle?: string;
  variant?: "primary" | "secondary";
};

export function MenuButton({
  disabled = false,
  iconLabel,
  iconSource,
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
      <View style={styles.outerGlow} />
      <View style={styles.goldLine} />
      <View style={styles.contentRow}>
        {iconSource || iconLabel ? (
          <View style={[styles.iconPlate, size === "small" ? styles.smallIconPlate : null]}>
            {iconSource ? (
              <Image source={iconSource} resizeMode="contain" style={[styles.iconImage, size === "small" ? styles.smallIconImage : null]} />
            ) : (
              <Text style={styles.iconText}>{iconLabel}</Text>
            )}
          </View>
        ) : null}
        <View style={styles.labelBlock}>
          <Text style={[styles.label, size === "small" ? styles.smallLabel : null]}>{label}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <Text style={styles.sideOrnament}>+</Text>
      <Text style={[styles.sideOrnament, styles.sideOrnamentLeft]}>+</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: "rgba(9, 13, 25, 0.76)",
    borderColor: gameTheme.colors.gold,
    borderWidth: 2,
    justifyContent: "center",
    overflow: "hidden",
    ...gameTheme.shadow,
  },
  contentRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 16,
    justifyContent: "center",
    width: "100%",
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
  iconPlate: {
    alignItems: "center",
    backgroundColor: "rgba(216, 168, 79, 0.18)",
    borderColor: "rgba(243, 213, 138, 0.72)",
    borderRadius: 36,
    borderWidth: 1,
    height: 58,
    justifyContent: "center",
    width: 58,
  },
  iconText: {
    color: gameTheme.colors.goldLight,
    fontSize: 16,
    fontWeight: "900",
  },
  iconImage: {
    height: 44,
    width: 44,
  },
  label: {
    color: gameTheme.colors.cream,
    fontSize: 29,
    fontWeight: "900",
    letterSpacing: 0,
    textAlign: "center",
  },
  labelBlock: {
    alignItems: "center",
    flexShrink: 1,
  },
  largeButton: {
    borderRadius: 34,
    minHeight: 86,
    paddingHorizontal: 26,
    paddingVertical: 14,
    width: "100%",
  },
  outerGlow: {
    ...StyleSheet.absoluteFillObject,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 34,
    borderWidth: 1,
    margin: 4,
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
    borderRadius: 21,
    flex: 1,
    minHeight: 62,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  smallIconPlate: {
    borderRadius: 22,
    height: 42,
    width: 42,
  },
  smallIconImage: {
    height: 30,
    width: 30,
  },
  smallLabel: {
    fontSize: 18,
  },
  sideOrnament: {
    color: "rgba(243, 213, 138, 0.7)",
    fontSize: 18,
    fontWeight: "900",
    position: "absolute",
    right: 17,
  },
  sideOrnamentLeft: {
    left: 17,
    right: undefined,
  },
  subtitle: {
    color: "rgba(255, 244, 214, 0.76)",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
    textAlign: "center",
  },
});
