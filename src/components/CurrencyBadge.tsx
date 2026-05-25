import { Animated, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useRef, useState } from "react";
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
  const [displayAmount, setDisplayAmount] = useState(amount);
  const [delta, setDelta] = useState(0);
  const flash = useRef(new Animated.Value(0)).current;
  const didMount = useRef(false);
  const displayAmountRef = useRef(amount);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      displayAmountRef.current = amount;
      setDisplayAmount(amount);
      return undefined;
    }

    const change = amount - displayAmountRef.current;
    if (change === 0) {
      return undefined;
    }

    setDelta(change);
    flash.setValue(0);
    Animated.sequence([
      Animated.timing(flash, {
        duration: 220,
        toValue: 1,
        useNativeDriver: false,
      }),
      Animated.delay(800),
      Animated.timing(flash, {
        duration: 240,
        toValue: 0,
        useNativeDriver: false,
      }),
    ]).start(() => setDelta(0));

    const direction = change > 0 ? 1 : -1;
    const step = Math.max(2, Math.ceil(Math.abs(change) / 36)) * direction;
    const timer = setInterval(() => {
      setDisplayAmount((current) => {
        const next = current + step;
        if ((direction > 0 && next >= amount) || (direction < 0 && next <= amount)) {
          clearInterval(timer);
          displayAmountRef.current = amount;
          return amount;
        }
        displayAmountRef.current = next;
        return next;
      });
    }, 32);

    return () => clearInterval(timer);
  }, [amount, flash]);

  const valueColor = flash.interpolate({
    inputRange: [0, 1],
    outputRange: [gameTheme.colors.cream, delta < 0 ? "#ff6b5f" : "#7dffaf"],
  });

  return (
    <View style={styles.badge}>
      <View style={[styles.icon, isCoins ? styles.coin : styles.gem]}>
        <Image source={currencyIcons[kind]} resizeMode="contain" style={styles.iconImage} />
      </View>
      <Animated.Text style={[styles.value, { color: valueColor }]}>{displayAmount.toLocaleString()}</Animated.Text>
      {delta !== 0 ? (
        <Animated.Text style={[styles.delta, delta < 0 ? styles.deltaNegative : styles.deltaPositive, { opacity: flash }]}>
          {delta > 0 ? "+" : ""}{delta}
        </Animated.Text>
      ) : null}
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
    overflow: "visible",
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
    fontSize: 15,
    fontWeight: "900",
    minWidth: 54,
    paddingHorizontal: 8,
    textAlign: "center",
  },
  delta: {
    bottom: -14,
    fontSize: 11,
    fontWeight: "900",
    position: "absolute",
    right: 38,
  },
  deltaNegative: {
    color: "#ff6b5f",
  },
  deltaPositive: {
    color: "#7dffaf",
  },
});
