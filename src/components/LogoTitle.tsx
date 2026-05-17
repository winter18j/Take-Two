import { Image, StyleSheet, Text, View } from "react-native";
import { gameTheme } from "../theme/gameTheme";

const logoImage = require("../../resources/menu/logo.png");

type LogoTitleProps = {
  subtitle?: string;
  title?: string;
};

export function LogoTitle({ subtitle = "Moroccan Card Battle", title = "Take Two" }: LogoTitleProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.logoPlaceholder}>
        <Image source={logoImage} resizeMode="contain" style={styles.logoImage} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.subtitleRow}>
        <View style={styles.rule} />
        <Text style={styles.subtitle}>{subtitle}</Text>
        <View style={styles.rule} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  logoPlaceholder: {
    alignItems: "center",
    backgroundColor: "rgba(111, 59, 181, 0.18)",
    borderColor: "rgba(243, 213, 138, 0.5)",
    borderRadius: 34,
    borderWidth: 0,
    height: 84,
    justifyContent: "center",
    marginBottom: -8,
    overflow: "hidden",
    width: 260,
  },
  logoImage: {
    height: 84,
    width: 260,
  },
  rule: {
    backgroundColor: "rgba(243, 213, 138, 0.78)",
    height: 1,
    width: 50,
  },
  subtitle: {
    color: "rgba(255, 244, 214, 0.82)",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0,
    marginTop: -2,
    textAlign: "center",
  },
  subtitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  title: {
    color: gameTheme.colors.cream,
    fontSize: 58,
    fontWeight: "900",
    letterSpacing: 0,
    textAlign: "center",
    textShadowColor: "rgba(216, 168, 79, 0.65)",
    textShadowOffset: { height: 2, width: 0 },
    textShadowRadius: 12,
  },
  wrap: {
    alignItems: "center",
    backgroundColor: "rgba(8, 11, 22, 0.28)",
    borderColor: "rgba(216, 168, 79, 0.18)",
    borderRadius: 40,
    borderWidth: 1,
    paddingHorizontal: 26,
    paddingVertical: 18,
  },
});
