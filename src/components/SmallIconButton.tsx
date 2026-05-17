import { Pressable, StyleSheet, Text } from "react-native";
import { gameTheme } from "../theme/gameTheme";

type SmallIconButtonProps = {
  disabled?: boolean;
  label: string;
  onPress: () => void;
};

export function SmallIconButton({ disabled = false, label, onPress }: SmallIconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
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
  pressed: {
    transform: [{ scale: 0.96 }],
  },
});
