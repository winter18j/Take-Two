import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { gameTheme } from "../theme/gameTheme";

type MenuCardProps = {
  children: ReactNode;
};

export function MenuCard({ children }: MenuCardProps) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: gameTheme.colors.panel,
    borderColor: "rgba(243, 213, 138, 0.26)",
    borderRadius: gameTheme.radius.lg,
    borderWidth: 1,
    gap: 10,
    padding: 14,
    width: "100%",
  },
});
