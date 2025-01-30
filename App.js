import { CameraView, useCameraPermissions } from "expo-camera";
import { useState, useEffect } from "react";
import { Button, StyleSheet, Text, TouchableOpacity, View, Modal, TextInput, StatusBar } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";

export default function App() {
  const [facing, setFacing] = useState("back");
  const [scanCooldown, setScanCooldown] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [scannedText, setScannedText] = useState("");
  const [scanPaused, setScanPaused] = useState(false);
  const [apiUrl, setApiUrl] = useState("");
  const [targetGender, setTargetGender] = useState("male");
  const [volunteerCode, setVolunteerCode] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [lastScannedData, setLastScannedData] = useState(null);
  const [apiStatus, setApiStatus] = useState("idle"); // Default to "idle"
  const [gender, setGender] = useState("");
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    const loadStatic = async () => {
      try {
        const storedUrl = await AsyncStorage.getItem("apiUrl");
        const storedGender = await AsyncStorage.getItem("targetGender");
        const volunteerCode = await AsyncStorage.getItem("volunteerCode");
        if (storedUrl) setApiUrl(storedUrl);
        if (storedGender) setTargetGender(storedGender);
        if (volunteerCode) setVolunteerCode(volunteerCode);
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };
    loadStatic();
  }, []);

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="Grant Permission" />
      </View>
    );
  }

  function toggleCameraFacing() {
    setFacing(facing === "back" ? "front" : "back");
  }

  function toggleTorch() {
    setTorch(!torch);
  }

  function handleBarcodeScanned(result) {
    if (scanPaused || scanCooldown || apiStatus === "loading") return;

    const data = result.data;
    if (data !== lastScannedData) {
      setScannedText(data);
      setLastScannedData(data);
      setScanPaused(true);
      setScanCooldown(true);
      makeApiRequest(data);

      setTimeout(() => {
        setScanCooldown(false);
        setScanPaused(false);
      }, 100); // Scan cooldown
    }
  }

  async function makeApiRequest(data) {
    try {
      if (!targetGender || !apiUrl || !volunteerCode) {
        setModalVisible(true);
      } else {
        setApiStatus("loading"); // Set status to loading initially

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ scannedData: data }),
        });

        if (response.ok) {
          setApiStatus("success"); // Set status to success
          setTimeout(() => {
            setApiStatus("idle"); // Reset status to idle after 100ms
          }, 500);
        } else {
          setApiStatus("error"); // Set status to error
          const errorMessage = await response.text();
          Toast.show({
            type: "error",
            position: "top",
            text1: "API Request Failed",
            text2: errorMessage || "There was an error with the request. Please try again.",
            visibilityTime: 3000,
          });
          setTimeout(() => {
            setApiStatus("idle"); // Reset status to idle after 100ms
          }, 500);
        }
      }
    } catch (error) {
      console.error("Error making API request:", error);
      setApiStatus("error");
      setTimeout(() => {
        setApiStatus("idle");
      }, 500);
    }
  }

  function resetScan() {
    setScannedText("");
    setLastScannedData(null);
    setApiStatus("idle");
    setScanPaused(false);
  }

  const getIndicatorColor = () => {
    switch (apiStatus) {
      case "success":
        return "#33cc33";
      case "error":
        return "red";
      case "loading":
        return "gray";
      default:
        return "gray";
    }
  };

  const handleSave = async () => {
    try {
      await AsyncStorage.setItem("apiUrl", apiUrl);
      await AsyncStorage.setItem("targetGender", targetGender);
      await AsyncStorage.setItem("volunteerCode", volunteerCode);
      setModalVisible(false);
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  };
  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <View style={styles.cameraContainer}>
        <CameraView style={styles.camera} facing={facing} enableTorch={torch} onBarcodeScanned={handleBarcodeScanned} />
      </View>

      {/* Status row */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          flex: 4,
          height: "100%",
          backgroundColor: apiStatus == "error" ? "rgba(255, 0, 0, 0.3)" : apiStatus == "success" ? "rgba(34, 255, 0, 0.3)" : "transparent",
          paddingHorizontal: 20,
        }}
      ></View>
      <View style={styles.statusRow}>
        <TouchableOpacity
          style={{
            padding: 10,
          }}
          onPress={resetScan}
        >
          <Text>Reset</Text>
        </TouchableOpacity>
        <View style={[styles.statusIndicator, { backgroundColor: getIndicatorColor() }]} />
      </View>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity style={styles.button} onPress={toggleCameraFacing}>
          <Ionicons name="camera-reverse" style={styles.icon} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={toggleTorch}>
          <Ionicons name={torch ? "flashlight" : "flashlight-outline"} style={styles.icon} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => setModalVisible(true)}>
          <Ionicons name="cog-outline" style={styles.icon} />
        </TouchableOpacity>
      </View>

      {/* Modal */}
      <Modal visible={modalVisible} onRequestClose={() => setModalVisible(false)} animationType="slide">
        <View style={styles.modalContainer}>
          <View>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 7,
              }}
            >
              <Text
                style={{
                  fontWeight: "500",
                  color: "rgba(0,0,0,0.8)",
                }}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={{
              justifyContent: "center",
              alignItems: "center",
              marginTop: 20,
            }}
          >
            <View
              style={{
                backgroundColor: "rgba(0,0,0,0.05)",
                height: 70,
                width: 70,
                borderRadius: 100,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons
                style={{
                  fontSize: 34,
                }}
                name="cog-outline"
              />
            </View>
          </View>
          <Text
            style={{
              textAlign: "center",
              marginTop: 20,
              fontSize: 16,
              color: "rgba(0,0,0,0.8)",
              fontWeight: "400",
            }}
          >
            General configurations
          </Text>
          <Text
            style={{
              textAlign: "center",
              marginTop: 10,
              fontSize: 12,
              color: "rgba(0,0,0,0.3)",
              fontWeight: "400",
            }}
          >
            v2.0.5
          </Text>

          <View style={{ marginTop: 30, backgroundColor: "rgba(0,0,0,0.05)", borderRadius: 15, overflow: "hidden" }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderBottomWidth: 1,
                borderBottomColor: "rgba(0,0,0,0.05)",
                gap: 6,
              }}
            >
              <View
                style={{
                  width: 60,
                  height: 60,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Ionicons
                  style={{
                    fontSize: 20,
                  }}
                  name="server-outline"
                />
              </View>
              <TextInput
                style={{
                  height: 60,
                  fontSize: 15,
                  width: "100%",
                }}
                value={apiUrl}
                onChangeText={setApiUrl}
                placeholder="Enter base url of the server"
                autoCapitalize="none"
              />
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderBottomWidth: 1,
                borderBottomColor: "rgba(0,0,0,0.05)",
                gap: 6,
              }}
            >
              <View
                style={{
                  width: 60,
                  height: 60,
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: "rgba(0,0,0,0.03)",
                }}
              >
                <Ionicons
                  style={{
                    fontSize: 20,
                  }}
                  name="toggle"
                />
              </View>
              <TextInput
                style={{
                  height: 60,
                  fontSize: 15,
                  width: "100%",
                }}
                value={targetGender}
                onChangeText={setTargetGender}
                placeholder="Scanning for 100-B / 101-G"
                autoCapitalize="none"
                keyboardType="numeric"
              />
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <View
                style={{
                  width: 60,
                  height: 60,
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: "rgba(0,0,0,0.03)",
                }}
              >
                <Ionicons
                  style={{
                    fontSize: 20,
                  }}
                  name="keypad-outline"
                />
              </View>
              <TextInput
                style={{
                  height: 60,
                  fontSize: 15,
                  width: "100%",
                }}
                value={volunteerCode}
                onChangeText={setVolunteerCode}
                placeholder="Volunteer code"
                autoCapitalize="none"
                keyboardType="numeric"
              />
            </View>
          </View>

          <View>
            <TouchableOpacity
              onPress={() => handleSave()}
              style={{
                backgroundColor: "rgba(0,0,0,0.9)",
                height: 45,
                justifyContent: "center",
                alignItems: "center",
                borderRadius: 100,
                marginTop: 20,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 16 }}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "column",
  },
  message: {
    textAlign: "center",
    paddingBottom: 10,
  },
  cameraContainer: {
    flex: 5,
    width: "100%",
  },
  camera: {
    flex: 1,
    width: "100%",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    backgroundColor: "rgba(255, 255, 255,1)",
  },
  resetButton: {
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.1)",
    borderRadius: 50,
  },
  resetIcon: {
    fontSize: 24,
    color: "#000",
  },
  statusIndicator: {
    width: 20,
    height: 20,
    borderRadius: 100,
  },
  controlsContainer: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-start",
    paddingTop: 40,
    backgroundColor: "rgba(255, 255, 255, 1)",
  },
  button: {
    marginHorizontal: 10,
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 100,
  },
  icon: {
    fontSize: 30,
    color: "#000",
  },
  modalContainer: {
    backgroundColor: "white",
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "100",
  },
  modalInput: {
    height: 60,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  modalParagraph: {
    fontSize: 13,
    marginTop: 5,
    color: "rgba(0,0,0,0.5)",
  },
  modalButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalButton: {
    backgroundColor: "#007bff",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 5,
    flex: 1,
    marginHorizontal: 5,
  },
  modalButtonText: {
    color: "white",
    textAlign: "center",
    fontSize: 16,
  },
  label: {
    fontSize: 18,
    marginBottom: 10,
    color: "#333",
  },
  dropdown: {
    width: 200,
    borderWidth: 1,
    borderColor: "#007AFF",
    borderRadius: 5,
    backgroundColor: "#fff",
  },
  picker: {
    width: "100%",
    height: 50,
  },
  selectedText: {
    marginTop: 20,
    fontSize: 16,
    fontWeight: "bold",
  },
});
