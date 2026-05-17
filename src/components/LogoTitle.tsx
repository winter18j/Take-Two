import { StyleSheet, Text, View } from "react-native";
import { gameTheme } from "../theme/gameTheme";

type LogoTitleProps = {
  subtitle?: string;
  title?: string;
};

export function LogoTitle({ subtitle = "Moroccan Card Battle", title = "Take Two" }: LogoTitleProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    color: "rgba(255, 244, 214, 0.82)",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0,
    marginTop: -2,
    textAlign: "center",
  },
  title: {
    color: gameTheme.colors.cream,
    fontSize: 52,
    fontWeight: "900",
    letterSpacing: 0,
    textAlign: "center",
    textShadowColor: "rgba(216, 168, 79, 0.65)",
    textShadowOffset: { height: 2, width: 0 },
    textShadowRadius: 12,
  },
  wrap: {
    alignItems: "center",
  },
});
