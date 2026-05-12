import { useEffect, useRef, useState } from "react";
import { Animated, ImageBackground, StyleSheet, View } from "react-native";

const APP_LAUNCH_BACKGROUND = require("../../resources/backgrounds/app-launch.png");

export function LaunchTransition() {
  const [visible, setVisible] = useState(true);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, {
        duration: 520,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.delay(760),
      Animated.timing(opacity, {
        duration: 620,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start(() => setVisible(false));
  }, [opacity]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View pointerEvents="none" style={[styles.overlay, { opacity }]}>
      <ImageBackground source={APP_LAUNCH_BACKGROUND} resizeMode="cover" style={styles.background}>
        <View style={styles.shade} />
      </ImageBackground>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#101317",
    zIndex: 100,
  },
  background: {
    flex: 1,
  },
  shade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 14, 18, 0.18)",
  },
});
