import type { User } from "@supabase/supabase-js";
import {
  ImageBackground,
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
const menuBackground = require("../../resources/cards-opti/table-1.png");

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
            musicMuted={musicMuted}
            onOpenProfile={onOpenProfile}
            onOpenSettings={onOpenSettings}
            onToggleMusicMute={onToggleMusicMute}
            tokens={120}
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
                label={matchmaking.queued ? `Finding Match ${matchmaking.seconds ?? 0}s` : "Play Random"}
                onPress={matchmaking.queued ? onCancelMatchmaking : onPlayRandom}
                subtitle={user ? "Ranked matchmaking" : "Sign in to unlock"}
              />
              {matchmaking.queued ? <Text style={styles.notice}>{queueText}</Text> : null}
              <MenuButton
                disabled={roomButtonsDisabled}
                label="Create Room"
                onPress={onCreateRoom}
                subtitle="Invite friends with a code"
                variant="secondary"
              />
              <View style={styles.smallGrid}>
                <MenuButton
                  disabled={roomButtonsDisabled}
                  label="Join Room"
                  onPress={onJoinRoom}
                  size="small"
                  variant="secondary"
                />
                <MenuButton label="Shop" onPress={onShop} size="small" variant="secondary" />
              </View>
              <MenuButton label="Profile" onPress={onOpenProfile} size="small" variant="secondary" />
            </View>

            {disabledText ? <Text style={styles.notice}>{disabledText}</Text> : null}

            <View style={styles.footer}>
              <Pressable style={styles.footerButton}>
                <Text style={styles.footerText}>How to Play</Text>
              </Pressable>
              <Pressable style={styles.footerButton}>
                <Text style={styles.footerText}>No Ads</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
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
    gap: 20,
    justifyContent: "center",
    paddingBottom: 28,
    paddingHorizontal: 22,
    paddingTop: 28,
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
  },
  footerButton: {
    borderBottomColor: "rgba(243, 213, 138, 0.42)",
    borderBottomWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  footerText: {
    color: "rgba(255, 244, 214, 0.78)",
    fontSize: 13,
    fontWeight: "800",
  },
  keyboardView: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 8,
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
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  smallGrid: {
    flexDirection: "row",
    gap: 12,
  },
});
