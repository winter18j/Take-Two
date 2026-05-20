import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { gameTheme } from "../theme/gameTheme";
import { playSound } from "../audio/soundEffects";

const currencyIcons = {
  coins: require("../../resources/menu/icons/coins.png"),
  gems: require("../../resources/menu/icons/gems.png"),
};

type CurrencyBadgeProps = {
  amount: number;
  kind: "coins" | "gems";
  onAdd?: () => void;
};

export function CurrencyBadge({ amount, kind, onAdd }: CurrencyBadgeProps) {
  const isCoins = kind === "coins";

  return (
    <View style={styles.badge}>
      <View style={[styles.icon, isCoins ? styles.coin : styles.gem]}>
        <Image source={currencyIcons[kind]} resizeMode="contain" style={styles.iconImage} />
      </View>
      <Text style={styles.value}>{amount.toLocaleString()}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void playSound("button");
          onAdd?.();
        }}
        style={styles.addButton}
      >
        <Text style={styles.addText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    alignItems: "center",
    borderLeftColor: "rgba(243, 213, 138, 0.28)",
    borderLeftWidth: 1,
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  addText: {
    color: gameTheme.colors.goldLight,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 24,
  },
  badge: {
    alignItems: "center",
    backgroundColor: "rgba(8, 11, 22, 0.82)",
    borderColor: "rgba(243, 213, 138, 0.76)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    height: 38,
    overflow: "hidden",
    paddingLeft: 5,
  },
  coin: {
    backgroundColor: gameTheme.colors.gold,
  },
  gem: {
    backgroundColor: gameTheme.colors.purple,
  },
  icon: {
    alignItems: "center",
    borderColor: gameTheme.colors.goldLight,
    borderRadius: 14,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  iconImage: {
    height: 24,
    width: 24,
  },
  value: {
    color: gameTheme.colors.cream,
    fontSize: 15,
    fontWeight: "900",
    minWidth: 54,
    paddingHorizontal: 8,
    textAlign: "center",
  },
});
