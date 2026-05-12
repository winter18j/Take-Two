import { Canvas, Image as SkiaImage, useImage } from "@shopify/react-native-skia";
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
  const image = useImage(source);

  if (!image) {
    return (
      <RNImage
        fadeDuration={0}
        resizeMethod={CARD_FACE_RESIZE_METHOD}
        resizeMode={fit}
        source={source}
        style={styles.fill}
      />
    );
  }

  const imageWidth = image.width();
  const imageHeight = image.height();
  const scale = fit === "cover"
    ? Math.max(width / imageWidth, height / imageHeight)
    : Math.min(width / imageWidth, height / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;

  return (
    <Canvas style={styles.fill}>
      <SkiaImage
        image={image}
        x={x}
        y={y}
        width={drawWidth}
        height={drawHeight}
      />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  fill: {
    height: "100%",
    width: "100%",
  },
});
