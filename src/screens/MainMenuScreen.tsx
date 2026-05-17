import type { User } from "@supabase/supabase-js";
import {
  ImageBackground,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LogoTitle } from "../components/LogoTitle";
import { MenuButton } from "../components/MenuButton";
import { MenuCard } from "../components/MenuCard";
import { TopBar } from "../components/TopBar";
import { gameTheme } from "../theme/gameTheme";

// Replace this require with the final generated main-menu background if you add a separate asset.
const menuBackground = require("../../resources/backgrounds/menu-main.png");
const menuIcons = {
  createRoom: require("../../resources/menu/icons/create-room.png"),
  customize: require("../../resources/menu/icons/customize.png"),
  dailyReward: require("../../resources/menu/icons/daily-reward.png"),
  joinRoom: require("../../resources/menu/icons/join-room.png"),
  navFriends: require("../../resources/menu/icons/nav-friends.png"),
  navHistory: require("../../resources/menu/icons/nav-history.png"),
  navHome: require("../../resources/menu/icons/nav-home.png"),
  navLeaderboard: require("../../resources/menu/icons/nav-leaderboard.png"),
  playRandom: require("../../resources/menu/icons/play-random.png"),
  rooms: require("../../resources/menu/icons/rooms.png"),
  shop: require("../../resources/menu/icons/shop.png"),
};

type MatchmakingState = {
  etaSeconds?: number;
  queued: boolean;
  seconds?: number;
};

type MainMenuScreenProps = {
  authBusy: boolean;
  authEmail: string;
  authPassword: string;
  disabledText: string;
  matchmaking: MatchmakingState;
  musicMuted: boolean;
  name: string;
  onCancelMatchmaking: () => void;
  onCloseProfile: () => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onPlayRandom: () => void;
  onShop: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onSignUp: () => void;
  onToggleMusicMute: () => void;
  profileOpen: boolean;
  setAuthEmail: (email: string) => void;
  setAuthPassword: (password: string) => void;
  setName: (name: string) => void;
  user: User | null;
};

export function MainMenuScreen({
  authBusy,
  authEmail,
  authPassword,
  disabledText,
  matchmaking,
  musicMuted,
  name,
  onCancelMatchmaking,
  onCloseProfile,
  onCreateRoom,
  onJoinRoom,
  onOpenProfile,
  onOpenSettings,
  onPlayRandom,
  onShop,
  onSignIn,
  onSignOut,
  onSignUp,
  onToggleMusicMute,
  profileOpen,
  setAuthEmail,
  setAuthPassword,
  setName,
  user,
}: MainMenuScreenProps) {
  const queueText = `Elapsed ${matchmaking.seconds ?? 0}s | ETA ${matchmaking.etaSeconds ?? 10}s`;
  const roomButtonsDisabled = matchmaking.queued;

  return (
    <ImageBackground source={menuBackground} resizeMode="cover" style={styles.background}>
      <View style={styles.shade} />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
          style={styles.keyboardView}
        >
          <TopBar
            coins={12540}
            gems={1285}
            musicMuted={musicMuted}
            onOpenProfile={onOpenProfile}
            onOpenSettings={onOpenSettings}
            onToggleMusicMute={onToggleMusicMute}
            playerName={name}
          />
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <LogoTitle />

            <MenuCard>
              <TextInput
                onChangeText={setName}
                placeholder="Player name"
                placeholderTextColor="rgba(255, 244, 214, 0.52)"
                style={styles.nameInput}
                value={name}
              />
            </MenuCard>

            <View style={styles.actions}>
              <MenuButton
                disabled={!user}
                iconSource={menuIcons.playRandom}
                label={matchmaking.queued ? `Finding Match ${matchmaking.seconds ?? 0}s` : "Play Random"}
                onPress={matchmaking.queued ? onCancelMatchmaking : onPlayRandom}
                subtitle={user ? "Ranked matchmaking" : "Sign in to unlock"}
              />
              {matchmaking.queued ? <Text style={styles.notice}>{queueText}</Text> : null}
              <MenuButton
                disabled={roomButtonsDisabled}
                iconSource={menuIcons.rooms}
                label="Rooms"
                onPress={onCreateRoom}
                subtitle="Play with Friends"
                variant="secondary"
              />
              <View style={styles.smallGrid}>
                <MenuButton
                  disabled={roomButtonsDisabled}
                  iconSource={menuIcons.createRoom}
                  label="Create"
                  onPress={onCreateRoom}
                  size="small"
                  variant="secondary"
                />
                <MenuButton
                  disabled={roomButtonsDisabled}
                  iconSource={menuIcons.joinRoom}
                  label="Join Room"
                  onPress={onJoinRoom}
                  size="small"
                  variant="secondary"
                />
              </View>
              <View style={styles.smallGrid}>
                <MenuButton disabled iconSource={menuIcons.customize} label="Customize" onPress={() => undefined} size="small" variant="secondary" />
                <MenuButton iconSource={menuIcons.shop} label="Shop" onPress={onShop} size="small" variant="secondary" />
              </View>
            </View>

            {disabledText ? <Text style={styles.notice}>{disabledText}</Text> : null}

            <View style={styles.rewardStrip}>
              <View style={styles.rewardIcon}>
                <Image source={menuIcons.dailyReward} resizeMode="contain" style={styles.rewardIconImage} />
              </View>
              <View style={styles.rewardCopy}>
                <Text style={styles.rewardTitle}>Daily Reward</Text>
                <Text style={styles.rewardText}>Come back every day!</Text>
              </View>
              <Pressable style={styles.claimButton}>
                <Text style={styles.claimText}>Claim</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <BottomNav />
      <ProfileModal
        authBusy={authBusy}
        authEmail={authEmail}
        authPassword={authPassword}
        onClose={onCloseProfile}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
        onSignUp={onSignUp}
        open={profileOpen}
        setAuthEmail={setAuthEmail}
        setAuthPassword={setAuthPassword}
        user={user}
      />
    </ImageBackground>
  );
}

function ProfileModal({
  authBusy,
  authEmail,
  authPassword,
  onClose,
  onSignIn,
  onSignOut,
  onSignUp,
  open,
  setAuthEmail,
  setAuthPassword,
  user,
}: {
  authBusy: boolean;
  authEmail: string;
  authPassword: string;
  onClose: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onSignUp: () => void;
  open: boolean;
  setAuthEmail: (email: string) => void;
  setAuthPassword: (password: string) => void;
  user: User | null;
}) {
  const authDisabled = authBusy || !authEmail.trim() || authPassword.length < 6;

  return (
    <Modal transparent animationType="fade" visible={open} onRequestClose={onClose}>
      <View style={styles.modalScrim}>
        <View style={styles.profilePanel}>
          <Text style={styles.profileTitle}>Profile</Text>
          <Text style={styles.profileText}>{user?.email ? user.email : "Playing as guest"}</Text>
          {!user ? (
            <>
              <TextInput
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={setAuthEmail}
                placeholder="Email"
                placeholderTextColor="rgba(255, 244, 214, 0.52)"
                style={styles.profileInput}
                value={authEmail}
              />
              <TextInput
                onChangeText={setAuthPassword}
                placeholder="Password"
                placeholderTextColor="rgba(255, 244, 214, 0.52)"
                secureTextEntry
                style={styles.profileInput}
                value={authPassword}
              />
              <View style={styles.modalActions}>
                <MenuButton label="Close" onPress={onClose} size="small" variant="secondary" />
                <MenuButton disabled={authDisabled} label="Sign In" onPress={onSignIn} size="small" />
              </View>
              <MenuButton disabled={authDisabled} label="Create Account" onPress={onSignUp} size="small" variant="secondary" />
            </>
          ) : (
            <View style={styles.modalActions}>
              <MenuButton label="Close" onPress={onClose} size="small" variant="secondary" />
              <MenuButton label="Disconnect" onPress={onSignOut} size="small" />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function BottomNav() {
  return (
    <View style={styles.bottomNav}>
      <NavItem label="Leaderboard" iconSource={menuIcons.navLeaderboard} disabled />
      <NavItem label="Friends" iconSource={menuIcons.navFriends} disabled />
      <NavItem label="Home" iconSource={menuIcons.navHome} active />
      <NavItem label="History" iconSource={menuIcons.navHistory} disabled />
    </View>
  );
}

function NavItem({ active = false, disabled = false, iconSource, label }: { active?: boolean; disabled?: boolean; iconSource: number; label: string }) {
  return (
    <Pressable disabled={disabled} style={[styles.navItem, active ? styles.navItemActive : null, disabled ? styles.navItemDisabled : null]}>
      <View style={[styles.navIconPlate, active ? styles.navIconPlateActive : null]}>
        <Image source={iconSource} resizeMode="contain" style={styles.navIcon} />
      </View>
      <Text style={styles.navLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 12,
    maxWidth: 390,
    width: "100%",
  },
  background: {
    flex: 1,
  },
  content: {
    alignItems: "center",
    flexGrow: 1,
    gap: 16,
    justifyContent: "center",
    paddingBottom: 96,
    paddingHorizontal: 14,
    paddingTop: 20,
  },
  keyboardView: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === "android" ? 34 : 26,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  modalScrim: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.54)",
    flex: 1,
    justifyContent: "center",
    padding: 22,
  },
  nameInput: {
    color: gameTheme.colors.cream,
    fontSize: 16,
    fontWeight: "900",
    minHeight: 48,
    paddingHorizontal: 2,
    textAlign: "center",
  },
  notice: {
    color: gameTheme.colors.cream,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  profileInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(243, 213, 138, 0.32)",
    borderRadius: gameTheme.radius.md,
    borderWidth: 1,
    color: gameTheme.colors.cream,
    fontSize: 15,
    minHeight: 50,
    paddingHorizontal: 12,
  },
  profilePanel: {
    backgroundColor: gameTheme.colors.panelStrong,
    borderColor: "rgba(243, 213, 138, 0.42)",
    borderRadius: gameTheme.radius.lg,
    borderWidth: 1,
    gap: 12,
    maxWidth: 380,
    padding: 16,
    width: "100%",
  },
  profileText: {
    color: "rgba(255, 244, 214, 0.78)",
    fontSize: 14,
    fontWeight: "800",
  },
  profileTitle: {
    color: gameTheme.colors.cream,
    fontSize: 22,
    fontWeight: "900",
  },
  safeArea: {
    flex: 1,
  },
  shade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.26)",
  },
  smallGrid: {
    flexDirection: "row",
    gap: 12,
  },
  bottomNav: {
    alignItems: "center",
    backgroundColor: "rgba(8, 11, 22, 0.9)",
    borderColor: "rgba(216, 168, 79, 0.38)",
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    left: 0,
    paddingBottom: Platform.OS === "android" ? 16 : 20,
    paddingTop: 10,
    position: "absolute",
    right: 0,
  },
  claimButton: {
    backgroundColor: "rgba(111, 59, 181, 0.86)",
    borderColor: gameTheme.colors.goldLight,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  claimText: {
    color: gameTheme.colors.cream,
    fontSize: 15,
    fontWeight: "900",
  },
  navIcon: {
    height: 22,
    width: 22,
  },
  navIconPlate: {
    alignItems: "center",
    borderColor: "rgba(243, 213, 138, 0.32)",
    borderRadius: 18,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  navIconPlateActive: {
    backgroundColor: "rgba(216, 168, 79, 0.22)",
    borderColor: gameTheme.colors.goldLight,
  },
  navItem: {
    alignItems: "center",
    gap: 3,
    minWidth: 70,
  },
  navItemActive: {
    opacity: 1,
  },
  navItemDisabled: {
    opacity: 0.44,
  },
  navLabel: {
    color: gameTheme.colors.cream,
    fontSize: 10,
    fontWeight: "800",
  },
  rewardCopy: {
    flex: 1,
  },
  rewardIcon: {
    alignItems: "center",
    backgroundColor: "rgba(216, 168, 79, 0.2)",
    borderColor: "rgba(243, 213, 138, 0.55)",
    borderRadius: 18,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 64,
  },
  rewardIconImage: {
    height: 42,
    width: 54,
  },
  rewardStrip: {
    alignItems: "center",
    backgroundColor: "rgba(8, 11, 22, 0.66)",
    borderColor: "rgba(243, 213, 138, 0.46)",
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    maxWidth: 390,
    padding: 12,
    width: "100%",
  },
  rewardText: {
    color: "rgba(255, 244, 214, 0.72)",
    fontSize: 13,
    fontWeight: "800",
  },
  rewardTitle: {
    color: gameTheme.colors.cream,
    fontSize: 16,
    fontWeight: "900",
  },
});
