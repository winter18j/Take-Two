import { StyleSheet, View } from "react-native";
import { SmallIconButton } from "./SmallIconButton";
import { TokenBadge } from "./TokenBadge";

type TopBarProps = {
  musicMuted: boolean;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onToggleMusicMute: () => void;
  tokens: number;
};

export function TopBar({
  musicMuted,
  onOpenProfile,
  onOpenSettings,
  onToggleMusicMute,
  tokens,
}: TopBarProps) {
  return (
    <View style={styles.topBar}>
      <SmallIconButton label="PROF" onPress={onOpenProfile} />
      <View style={styles.rightCluster}>
        <TokenBadge tokens={tokens} />
        <SmallIconButton label={musicMuted ? "MUS" : "SND"} onPress={onToggleMusicMute} />
        <SmallIconButton label="SET" onPress={onOpenSettings} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rightCluster: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
});
