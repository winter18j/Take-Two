import { StyleSheet, Text, View } from "react-native";
import { gameTheme } from "../theme/gameTheme";

type TokenBadgeProps = {
  tokens: number;
};

export function TokenBadge({ tokens }: TokenBadgeProps) {
  return (
    <View style={styles.badge}>
      <View style={styles.coin}>
        <Text style={styles.coinText}>T</Text>
      </View>
      <Text style={styles.value}>{tokens.toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    backgroundColor: gameTheme.colors.panelStrong,
    borderColor: "rgba(243, 213, 138, 0.72)",
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 44,
    paddingLeft: 8,
    paddingRight: 14,
  },
  coin: {
    alignItems: "center",
    backgroundColor: gameTheme.colors.gold,
    borderColor: gameTheme.colors.goldLight,
    borderRadius: 15,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  coinText: {
    color: gameTheme.colors.navyBlack,
    fontSize: 14,
    fontWeight: "900",
  },
  value: {
    color: gameTheme.colors.cream,
    fontSize: 16,
    fontWeight: "900",
  },
});
