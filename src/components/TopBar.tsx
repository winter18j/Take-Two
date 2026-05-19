import { StyleSheet, Text, View } from "react-native";
import { gameTheme } from "../theme/gameTheme";
import { CurrencyBadge } from "./CurrencyBadge";
import { SmallIconButton } from "./SmallIconButton";

const topBarIcons = {
  profile: require("../../resources/menu/icons/profile.png"),
  settings: require("../../resources/menu/icons/settings.png"),
  soundOff: require("../../resources/menu/icons/sound-off.png"),
  soundOn: require("../../resources/menu/icons/sound-on.png"),
};

type TopBarProps = {
  coins: number;
  gems: number;
  musicMuted: boolean;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onToggleMusicMute: () => void;
  playerName: string;
};

export function TopBar({
  coins,
  gems,
  musicMuted,
  onOpenProfile,
  onOpenSettings,
  onToggleMusicMute,
  playerName,
}: TopBarProps) {
  return (
    <View style={styles.topBar}>
      <View style={styles.profileCluster}>
        <SmallIconButton iconSource={topBarIcons.profile} label="Profile" onPress={onOpenProfile} round size="large" />
        <View style={styles.profileTextBlock}>
          <Text numberOfLines={1} style={styles.playerName}>{playerName || "PlayerOne"}</Text>
        </View>
      </View>
      <View style={styles.walletAndControls}>
        <View style={styles.walletRow}>
          <CurrencyBadge amount={coins} kind="coins" />
          <CurrencyBadge amount={gems} kind="gems" />
        </View>
        <View style={styles.controlRow}>
          <SmallIconButton iconSource={topBarIcons.settings} label="Settings" onPress={onOpenSettings} round />
          <SmallIconButton iconSource={musicMuted ? topBarIcons.soundOff : topBarIcons.soundOn} label="Sound" onPress={onToggleMusicMute} round />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  controlRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
  },
  playerName: {
    color: gameTheme.colors.cream,
    fontSize: 18,
    fontWeight: "900",
    maxWidth: 130,
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 4,
  },
  profileCluster: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    gap: 8,
  },
  profileTextBlock: {
    flexShrink: 1,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  walletAndControls: {
    alignItems: "flex-end",
    gap: 8,
  },
  walletRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
});
