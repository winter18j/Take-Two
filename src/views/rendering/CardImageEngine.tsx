import { Image as RNImage, StyleSheet } from "react-native";

const CARD_FACE_RESIZE_METHOD = "resize" as const;

export function CardImageEngine({
  fit = "contain",
  height,
  source,
  width,
}: {
  fit?: "contain" | "cover";
  height: number;
  source: number;
  width: number;
}) {
  return (
    <RNImage
      fadeDuration={0}
      resizeMethod={CARD_FACE_RESIZE_METHOD}
      resizeMode={fit}
      source={source}
      style={[styles.fill, { height, width }]}
    />
  );
}

const styles = StyleSheet.create({
  fill: {
    height: "100%",
    width: "100%",
  },
});
