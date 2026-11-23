import React, { useEffect, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  MOBILE_PALETTE,
  cancelSosCountdown,
  canCorroborateIncident,
  createSosCountdown,
  evaluateSafeWalkDeadline,
  resolveBanglaOrBanglishThana,
  tickSosCountdown,
  type SosCountdownState,
} from "./src/citizenCore";

type TabId = "home" | "map" | "reports" | "ai";
type ViewStateMode = "live" | "loading" | "empty" | "error";

interface CitizenReportItem {
  id: string;
  title: string;
  area: string;
  lat: number;
  lng: number;
  corroborations: number;
  authorLabel: string;
}

const INITIAL_REPORTS: CitizenReportItem[] = [
  {
    id: "33333333-3333-4333-8333-333333333301",
    title: "Phone snatching near Kalabagan footover bridge",
    area: "Dhanmondi",
    lat: 23.7495,
    lng: 90.3806,
    corroborations: 2,
    authorLabel: "Anonymous Citizen",
  },
  {
    id: "33333333-3333-4333-8333-333333333303",
    title: "Evening harassment outside Mirpur-10 metro exit",
    area: "Mirpur-10",
    lat: 23.8072,
    lng: 90.369,
    corroborations: 3,
    authorLabel: "Anonymous Citizen",
  },
];

export default function App() {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = MOBILE_PALETTE[scheme];

  const [tab, setTab] = useState<TabId>("home");
  const [viewMode, setViewMode] = useState<ViewStateMode>("live");
  const [sosState, setSosState] = useState<SosCountdownState>({ status: "idle", secondsRemaining: 0 });
  const [sosBanner, setSosBanner] = useState<string | null>(null);
  const [walkTarget] = useState("TSC, Dhaka University");
  const [walkDeadline, setWalkDeadline] = useState(() => new Date(Date.now() + 18 * 60_000).toISOString());
  const [walkActive, setWalkActive] = useState(true);
  const [reports, setReports] = useState<CitizenReportItem[]>(INITIAL_REPORTS);

  const [reportTitle, setReportTitle] = useState("");
  const [reportArea, setReportArea] = useState("Dhanmondi");
  const [hideIdentity, setHideIdentity] = useState(true);
  const [aiQuery, setAiQuery] = useState("Dhanmondi te raat e hata safe?");
  const [aiReply, setAiReply] = useState<string | null>(null);

  const userLat = 23.7465;
  const userLng = 90.376;

  useEffect(() => {
    if (sosState.status !== "countdown") return;
    const timer = setTimeout(() => {
      setSosState((prev) => {
        const next = tickSosCountdown(prev);
        if (next.status === "transmitting") {
          setSosBanner("SOS transmitted to Police Monitor (Simulated 999 Relay).");
        }
        return next;
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [sosState]);

  const walkStatus = evaluateSafeWalkDeadline(walkDeadline);
  const nearestThana = resolveBanglaOrBanglishThana("dhanmondi");

  const handlePublish = () => {
    if (!reportTitle.trim()) return;
    setReports((prev) => [
      {
        id: `rep-${Date.now()}`,
        title: reportTitle.trim(),
        area: reportArea,
        lat: userLat,
        lng: userLng,
        corroborations: 0,
        authorLabel: hideIdentity ? "Anonymous Citizen" : "Nadia Rahman",
      },
      ...prev,
    ]);
    setReportTitle("");
    setTab("home");
  };

  const handleAskAi = () => {
    const station = resolveBanglaOrBanglishThana(aiQuery);
    setAiReply(
      `Nearest station: ${station.name_en} (${station.name_bn}) · Duty phone: ${station.phone}. Keep Safe Walk active when commuting at night.`
    );
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.canvas }]}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />

      {/* Top Header */}
      <View style={[styles.header, { backgroundColor: colors.primaryTeal }]}>
        <View>
          <Text style={styles.headerSub}>Dhanmondi, Dhaka · Demo Citizen</Text>
          <Text style={styles.headerTitle}>Daak Safety</Text>
        </View>
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreText}>Safety 78</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {viewMode === "loading" && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
            <Text style={{ color: colors.inkSecondary }}>Loading neighborhood safety snapshot...</Text>
          </View>
        )}

        {viewMode === "error" && (
          <View style={[styles.card, { backgroundColor: colors.emergencySoft, borderColor: colors.emergencyCrimson }]}>
            <Text style={{ color: colors.emergencyCrimson, fontWeight: "700" }}>
              Connection delayed — retry or call 999 directly.
            </Text>
            <Pressable style={[styles.actionBtn, { borderColor: colors.hairline, marginTop: 8 }]} onPress={() => setViewMode("live")}>
              <Text style={{ color: colors.inkPrimary, fontWeight: "600" }}>Retry</Text>
            </Pressable>
          </View>
        )}

        {viewMode === "empty" && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
            <Text style={{ color: colors.inkPrimary, fontWeight: "600" }}>No nearby reports</Text>
            <Pressable style={[styles.actionBtn, { borderColor: colors.hairline, marginTop: 8 }]} onPress={() => setViewMode("live")}>
              <Text style={{ color: colors.inkPrimary }}>Restore demo feed</Text>
            </Pressable>
          </View>
        )}

        {viewMode === "live" && tab === "home" && (
          <>
            {sosBanner && (
              <View style={[styles.card, { backgroundColor: colors.emergencySoft, borderColor: colors.emergencyCrimson }]}>
                <Text style={{ color: colors.emergencyCrimson, fontWeight: "700" }}>{sosBanner}</Text>
              </View>
            )}

            {walkActive && (
              <View style={[styles.card, { backgroundColor: colors.railMuted, borderColor: colors.hairline }]}>
                <Text style={{ color: colors.inkPrimary, fontWeight: "700" }}>
                  Safe Walk: {walkTarget} ({Math.ceil(walkStatus.remainingSeconds / 60)}m left)
                </Text>
                <View style={styles.rowGap}>
                  <Pressable
                    style={[styles.actionBtn, { backgroundColor: colors.primaryTeal, flex: 1 }]}
                    onPress={() => setWalkActive(false)}
                  >
                    <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>Check in safe</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionBtn, { borderColor: colors.hairline, backgroundColor: colors.surface, flex: 1 }]}
                    onPress={() => {
                      setWalkDeadline(new Date(Date.now() - 1000).toISOString());
                      setSosBanner("Safe Walk timeout escalated to Police Monitor.");
                    }}
                  >
                    <Text style={{ color: colors.inkPrimary, fontWeight: "600" }}>Escalate now</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Tactile 5s SOS Ring */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline, alignItems: "center" }]}>
              {sosState.status !== "countdown" ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Trigger SOS 5 second countdown"
                  style={[styles.sosCircle, { backgroundColor: colors.emergencyCrimson }]}
                  onPress={() => setSosState(createSosCountdown(5))}
                >
                  <Text style={styles.sosTitle}>SOS</Text>
                  <Text style={styles.sosSub}>Tap for 5s countdown</Text>
                </Pressable>
              ) : (
                <View style={{ alignItems: "center", gap: 10 }}>
                  <View style={[styles.sosCountdown, { borderColor: colors.emergencyCrimson, backgroundColor: colors.emergencySoft }]}>
                    <Text style={{ color: colors.emergencyCrimson, fontSize: 32, fontWeight: "700" }}>
                      {sosState.secondsRemaining}
                    </Text>
                  </View>
                  <Pressable
                    style={[styles.actionBtn, { borderColor: colors.hairline, minWidth: 180 }]}
                    onPress={() => setSosState((prev) => cancelSosCountdown(prev))}
                  >
                    <Text style={{ color: colors.inkPrimary, fontWeight: "700" }}>Cancel SOS</Text>
                  </Pressable>
                </View>
              )}
              <Text style={{ color: colors.inkSecondary, fontSize: 12, marginTop: 10 }}>
                Nearest: {nearestThana.name_en} ({nearestThana.phone})
              </Text>
            </View>

            {/* Nearby Reports */}
            <Text style={[styles.sectionTitle, { color: colors.inkPrimary }]}>Nearby Verified Reports</Text>
            {reports.map((rep) => {
              const check = canCorroborateIncident(rep.lat, rep.lng, userLat, userLng, false);
              return (
                <View key={rep.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
                  <Text style={{ color: colors.inkPrimary, fontWeight: "700" }}>{rep.title}</Text>
                  <Text style={{ color: colors.inkSecondary, fontSize: 12, marginVertical: 4 }}>
                    {rep.area} · By {rep.authorLabel} · {check.distanceMeters}m away
                  </Text>
                  <Pressable
                    disabled={!check.allowed}
                    style={[
                      styles.actionBtn,
                      {
                        borderColor: colors.hairline,
                        backgroundColor: check.allowed ? colors.railMuted : colors.surface,
                        opacity: check.allowed ? 1 : 0.55,
                      },
                    ]}
                    onPress={() =>
                      setReports((prev) =>
                        prev.map((item) =>
                          item.id === rep.id ? { ...item, corroborations: item.corroborations + 1 } : item
                        )
                      )
                    }
                  >
                    <Text style={{ color: colors.inkPrimary, fontWeight: "600" }}>
                      {check.allowed
                        ? `I saw this too (${rep.corroborations})`
                        : `Outside 1 km (${rep.corroborations})`}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </>
        )}

        {viewMode === "live" && tab === "map" && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
            <Text style={{ color: colors.inkPrimary, fontWeight: "700", marginBottom: 6 }}>
              Dhaka Area Safety Snapshot
            </Text>
            <Text style={{ color: colors.inkSecondary }}>Dhanmondi: 78 (Safe) · Mirpur-10: 58 (Moderate) · Shahbagh: 82 (Safe)</Text>
          </View>
        )}

        {viewMode === "live" && tab === "reports" && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline, gap: 10 }]}>
            <Text style={{ color: colors.inkPrimary, fontWeight: "700" }}>Report an Incident</Text>
            <TextInput
              value={reportTitle}
              onChangeText={setReportTitle}
              placeholder="Headline (e.g. Snatching near Science Lab)"
              placeholderTextColor={colors.inkSecondary}
              style={[styles.input, { borderColor: colors.hairline, color: colors.inkPrimary }]}
            />
            <TextInput
              value={reportArea}
              onChangeText={setReportArea}
              placeholder="Area (e.g. Dhanmondi)"
              placeholderTextColor={colors.inkSecondary}
              style={[styles.input, { borderColor: colors.hairline, color: colors.inkPrimary }]}
            />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48 }}>
              <Text style={{ color: colors.inkPrimary }}>Hide my name publicly</Text>
              <Switch value={hideIdentity} onValueChange={setHideIdentity} />
            </View>
            <Pressable style={[styles.actionBtn, { backgroundColor: colors.primaryTeal }]} onPress={handlePublish}>
              <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Publish report</Text>
            </Pressable>
          </View>
        )}

        {viewMode === "live" && tab === "ai" && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline, gap: 10 }]}>
            <Text style={{ color: colors.inkPrimary, fontWeight: "700" }}>DaakAI (Bangla / Banglish)</Text>
            <TextInput
              value={aiQuery}
              onChangeText={setAiQuery}
              placeholder="Ask about an area or nearest Thana"
              placeholderTextColor={colors.inkSecondary}
              style={[styles.input, { borderColor: colors.hairline, color: colors.inkPrimary }]}
            />
            <Pressable style={[styles.actionBtn, { backgroundColor: colors.primaryTeal }]} onPress={handleAskAi}>
              <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Ask DaakAI</Text>
            </Pressable>
            {aiReply && <Text style={{ color: colors.inkPrimary }}>{aiReply}</Text>}
          </View>
        )}
      </ScrollView>

      {/* Bottom Material / HIG 4-Tab Bar (min 48dp height) */}
      <View style={[styles.tabBar, { backgroundColor: colors.surface, borderTopColor: colors.hairline }]}>
        {(["home", "map", "reports", "ai"] as TabId[]).map((item) => (
          <Pressable
            key={item}
            style={[styles.tabItem, tab === item && { backgroundColor: colors.railMuted }]}
            onPress={() => setTab(item)}
          >
            <Text style={{ color: tab === item ? colors.primaryTeal : colors.inkSecondary, fontWeight: "700", fontSize: 12 }}>
              {item === "home" ? "Home" : item === "map" ? "Map" : item === "reports" ? "Reports" : "DaakAI"}
            </Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerSub: { color: "#D6ECE8", fontSize: 12 },
  headerTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  scoreBadge: {
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  scoreText: { color: "#FFFFFF", fontWeight: "700", fontSize: 12 },
  scrollContent: { padding: 14, gap: 12 },
  card: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 6 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginTop: 4 },
  rowGap: { flexDirection: "row", gap: 8, marginTop: 6 },
  actionBtn: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  sosCircle: {
    width: 148,
    height: 148,
    borderRadius: 74,
    alignItems: "center",
    justifyContent: "center",
  },
  sosTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "700" },
  sosSub: { color: "#FFFFFF", fontSize: 11, marginTop: 2 },
  sosCountdown: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  tabBar: { flexDirection: "row", borderTopWidth: 1 },
  tabItem: { flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center" },
});
