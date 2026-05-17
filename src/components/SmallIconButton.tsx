import type { ImageSourcePropType } from "react-native";
import { Image, Pressable, StyleSheet, Text } from "react-native";
import { gameTheme } from "../theme/gameTheme";

type SmallIconButtonProps = {
  disabled?: boolean;
  iconSource?: ImageSourcePropType;
  label: string;
  onPress: () => void;
  round?: boolean;
  size?: "normal" | "large";
};

export function SmallIconButton({ disabled = false, iconSource, label, onPress, round = false, size = "normal" }: SmallIconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        round ? styles.round : null,
        size === "large" ? styles.large : null,
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      {iconSource ? (
        <Image source={iconSource} resizeMode="contain" style={[styles.icon, size === "large" ? styles.largeIcon : null]} />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: gameTheme.colors.panelStrong,
    borderColor: "rgba(243, 213, 138, 0.62)",
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    minWidth: 44,
    paddingHorizontal: 12,
  },
  disabled: {
    opacity: 0.46,
  },
  label: {
    color: gameTheme.colors.cream,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
  },
  icon: {
    height: 24,
    width: 24,
  },
  largeIcon: {
    height: 42,
    width: 42,
  },
  pressed: {
    transform: [{ scale: 0.96 }],
  },
  large: {
    borderRadius: 34,
    height: 68,
    width: 68,
  },
  round: {
    borderRadius: 24,
  },
});
