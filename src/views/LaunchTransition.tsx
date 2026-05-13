import { useEffect, useRef, useState } from "react";
import { Animated, ImageBackground, StyleSheet, Text, View } from "react-native";

const APP_LAUNCH_BACKGROUND = require("../../resources/backgrounds/app-launch.png");

export function LaunchTransition({
  connected,
  onFinish,
  progress,
  status,
}: {
  connected: boolean;
  onFinish: () => void;
  progress: number;
  status: string;
}) {
  const [visible, setVisible] = useState(true);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      duration: 420,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  useEffect(() => {
    if (!connected) {
      return;
    }

    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        duration: 540,
        toValue: 0,
        useNativeDriver: true,
      }).start(() => {
        setVisible(false);
        onFinish();
      });
    }, 280);

    return () => clearTimeout(timer);
  }, [connected, onFinish, opacity]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View pointerEvents="none" style={[styles.overlay, { opacity }]}>
      <ImageBackground source={APP_LAUNCH_BACKGROUND} resizeMode="cover" style={styles.background}>
        <View style={styles.shade} />
        <View style={styles.content}>
          <Text style={styles.title}>Take Two</Text>
          <Text style={styles.status}>{status}</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(0.08, Math.min(1, progress)) * 100}%` }]} />
          </View>
        </View>
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
  content: {
    alignItems: "center",
    bottom: 92,
    gap: 12,
    left: 24,
    position: "absolute",
    right: 24,
  },
  fill: {
    backgroundColor: "#f6d878",
    borderRadius: 8,
    height: "100%",
  },
  shade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 14, 18, 0.38)",
  },
  status: {
    color: "#f4ead8",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  title: {
    color: "#ffffff",
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: 0,
  },
  track: {
    backgroundColor: "rgba(255,255,255,0.22)",
    borderColor: "rgba(255,255,255,0.24)",
    borderRadius: 8,
    borderWidth: 1,
    height: 10,
    maxWidth: 300,
    overflow: "hidden",
    width: "72%",
  },
});
