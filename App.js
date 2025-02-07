import { CameraView, useCameraPermissions } from "expo-camera";
import { useState, useEffect } from "react";
import { Button, StyleSheet, Text, TouchableOpacity, View, Modal, TextInput, StatusBar, Alert } from "react-native";
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
  const [apiStatus, setApiStatus] = useState("idle");
  const [password, setPassword] = useState("");
  const [isAppReady, setIsAppReady] = useState(false);
  const [loginModalVisible, setLoginModalVisible] = useState(true);

  useEffect(() => {
    const loadStatic = async () => {
      try {
        const storedUrl = await AsyncStorage.getItem("apiUrl");
        const storedPassword = await AsyncStorage.getItem("password");
        const storedGender = await AsyncStorage.getItem("targetGender");
        const storedVolunteerCode = await AsyncStorage.getItem("volunteerCode");
        
        if (storedUrl && storedPassword) {
          setApiUrl(storedUrl);
          setPassword(storedPassword);
          if (storedGender) setTargetGender(storedGender);
          if (storedVolunteerCode) setVolunteerCode(storedVolunteerCode);
          verifyStartupCredentials(storedUrl, storedPassword);
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };
    loadStatic();
  }, []);



  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Loading camera permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="Grant Permission" />
      </View>
    );
  }


  
    async function verifyStartupCredentials(url, pwd) {
      if (!url || !pwd || !targetGender || !volunteerCode) {
        Toast.show({
          type: "error",
          text1: "Configuration Error",
          text2: "Please fill in all required fields",
        });
        return;
      }
  
      try {
        const response = await fetch(`${url}/verify-password`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            password: pwd
          }),
        });
  
        if (response.ok) {
          await AsyncStorage.setItem("apiUrl", url);
          await AsyncStorage.setItem("password", pwd);
          await AsyncStorage.setItem("targetGender", targetGender);
          await AsyncStorage.setItem("volunteerCode", volunteerCode);
          setIsAppReady(true);
          setLoginModalVisible(false);
        } else {
          Toast.show({
            type: "error",
            text1: "Authentication Failed",
            text2: "Incorrect credentials",
          });
        }
      } catch (error) {
        console.error("Verification error:", error);
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Failed to verify credentials",
        });
      }
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
      ProcessQRSCAN(data,volunteerCode)

      setTimeout(() => {
        setScanCooldown(false);
        setScanPaused(false);
      }, 1000);
    }
  }

  async function ProcessQRSCAN(kfid, volunteerCode){
    try{
      const response = await fetch(`${apiUrl}`,{
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kfid,
          volunteerCode
        })
      })

      const result = await response.json();

      if(!response.ok){
        Toast.show({
          type: "error",
          text1: "ERROR",
          text2: result.message,
        });
        setApiStatus("error");
      }else{
        Toast.show({
          type: "success",
          text1: "SUCCESS",
          text2: result.message,
        });
        setApiStatus("success");
      }
    }catch(error){
      console.error("Distribution Error:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to Process Request",
      });
      setApiStatus("error");
    }finally{
      setTimeout(() => {
        setApiStatus("idle");
      }, 500);
    }
  }

  async function processTeeDelivery(id) {
    try {
      const response = await fetch(`${apiUrl}/tee-order/deliver`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: id,
        }),
      });

      if (response.ok) {
        Toast.show({
          type: "success",
          text1: "Success",
          text2: "TEE order marked as delivered",
        });
        setApiStatus("success");
      } else {
        const errorData = await response.json();
        Toast.show({
          type: "error",
          text1: "Delivery Failed",
          text2: errorData.message || "Failed to mark order as delivered",
        });
        setApiStatus("error");
      }
    } catch (error) {
      console.error("Error processing delivery:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to process delivery",
      });
      setApiStatus("error");
    } finally {
      setTimeout(() => {
        setApiStatus("idle");
      }, 500);
    }
  }

  function confirmDelivery(id, participantEmail, size) {

    console.log(id,participantEmail,size);
    Alert.alert(
      "Confirm Delivery",
      `Verify delivery for:\nEmail: ${participantEmail}\nSize: ${size}\nOrderId: ${id}`,
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {
            setApiStatus("idle");
          },
        },
        {
          text: "Confirm",
          onPress: () => {
            processTeeDelivery(id);
          },
        },
      ],
      "secure-text"
    );
  }

  async function processKfid(qrData) {
    try {
      setApiStatus("loading");

      let kfid = qrData.trim();

      const orderResponse = await fetch(`${apiUrl}/tee-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kfid,
        }),
      });

      const result = await orderResponse.json();

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json();
        Toast.show({
          type: "error",
          text1: "Error",
          text2: errorData.error || "Failed to process KFID",
        });
        setApiStatus("error");
        return;
      }

      const {id} = result.teeOrders[0];
      const {size} = result.teeOrders[0];
      const {participantEmail} = result.teeOrders[0];
      console.log(id,size,participantEmail);

      confirmDelivery(id, participantEmail, size);

    } catch (error) {
      console.error("Error processing KFID:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to process KFID",
      });
      setApiStatus("error");
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
      Toast.show({
        type: "success",
        text1: "Success",
        text2: "Settings saved successfully",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to save settings",
      });
    }
  };

  if (!isAppReady) {
    return (
      <Modal 
        visible={loginModalVisible}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.loginModalContainer}>
          <View style={styles.loginModalContent}>
            <Text style={styles.loginTitle}>Initial Setup</Text>
            
            <Text style={styles.inputLabel}>API URL</Text>
            <TextInput
              style={styles.loginInput}
              placeholder="Enter API URL"
              value={apiUrl}
              onChangeText={setApiUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
            
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              style={styles.loginInput}
              placeholder="Enter Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <Text style={styles.inputLabel}>Target Gender</Text>
            <TextInput
              style={styles.loginInput}
              placeholder="Enter Target Gender (male/female)"
              value={targetGender}
              onChangeText={setTargetGender}
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Volunteer Code</Text>
            <TextInput
              style={styles.loginInput}
              placeholder="Enter Volunteer Code"
              value={volunteerCode}
              onChangeText={setVolunteerCode}
              keyboardType="numeric"
            />
            
            <TouchableOpacity 
              style={[
                styles.loginButton,
                (!apiUrl || !password || !targetGender || !volunteerCode) && 
                styles.loginButtonDisabled
              ]} 
              onPress={() => verifyStartupCredentials(apiUrl, password)}
              disabled={!apiUrl || !password || !targetGender || !volunteerCode}
            >
              <Text style={styles.loginButtonText}>Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <View style={styles.cameraContainer}>
        <CameraView 
          style={styles.camera} 
          facing={facing} 
          enableTorch={torch} 
          onBarcodeScanned={handleBarcodeScanned}
        />
      </View>

      <View
        style={[
          styles.overlay,
          {
            backgroundColor: 
              apiStatus === "error" ? "rgba(255, 0, 0, 0.3)" : 
              apiStatus === "success" ? "rgba(34, 255, 0, 0.3)" : 
              "transparent",
          }
        ]}
      />

      <View style={styles.statusRow}>
        <TouchableOpacity style={styles.resetButton} onPress={resetScan}>
          <Text>Reset</Text>
        </TouchableOpacity> 
        <View style={[styles.statusIndicator, { backgroundColor: getIndicatorColor() }]} />
      </View>

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

      <Modal visible={modalVisible} onRequestClose={() => setModalVisible(false)} animationType="slide">
        <View style={styles.modalContainer}>
          <View>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalHeader}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="cog-outline" style={styles.modalHeaderIcon} />
            </View>
            <Text style={styles.modalTitle}>General configurations</Text>
            <Text style={styles.modalVersion}>v2.0.5</Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <View style={styles.inputIconContainer}>
                <Ionicons name="server-outline" style={styles.inputIcon} />
              </View>
              <TextInput
                style={styles.input}
                value={apiUrl}
                onChangeText={setApiUrl}
                placeholder="Enter base url of the server"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <View style={styles.inputIconContainer}>
                <Ionicons name="toggle" style={styles.inputIcon} />
              </View>
              <TextInput
                style={styles.input}
                value={targetGender}
                onChangeText={setTargetGender}
                placeholder="Target Gender (male/female)"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <View style={styles.inputIconContainer}>
                <Ionicons name="keypad-outline" style={styles.inputIcon} />
              </View>
              <TextInput
                style={styles.input}
                value={volunteerCode}
                onChangeText={setVolunteerCode}
                placeholder="Volunteer Code"
                keyboardType="numeric"
              />
            </View>
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>
      </Modal>
      <Toast />
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
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    backgroundColor: "white",
  },
  resetButton: {
    padding: 10,
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
    backgroundColor: "white",
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
  modalHeader: {
    alignItems: "center",
    marginTop: 20,
  },
  modalIconContainer: {
    backgroundColor: "rgba(0,0,0,0.05)",
    height: 70,
    width: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
  },
  modalHeaderIcon: {
    fontSize: 34,
  },
  modalTitle: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 16,
    color: "rgba(0,0,0,0.8)",
    fontWeight: "400",
  },
  modalVersion: {
    textAlign: "center",
    marginTop: 10,
    fontSize: 12,
    color: "rgba(0,0,0,0.3)",
    fontWeight: "400",
  },
  formContainer: {
    marginTop: 30,
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 15,
    overflow: "hidden",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  inputIconContainer: {
    width: 60,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.03)",
  },
  inputIcon: {
    fontSize: 20,
  },
  input: {
    height: 60,
    fontSize: 15,
    flex: 1,
    paddingHorizontal: 10,
  },
  saveButton: {
    backgroundColor: "rgba(0,0,0,0.9)",
    height: 45,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 100,
    marginTop: 20,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
  },
  loginModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  loginModalContent: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },
  loginTitle: {
    fontSize: 18,
    marginBottom: 20,
  },
  loginInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
  },
  loginButton: {
    backgroundColor: 'black',
    padding: 10,
    borderRadius: 5,
    width: '100%',
    alignItems: 'center',
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
  },

  inputLabel: {
    alignSelf: 'flex-start',
    marginBottom: 5,
    fontSize: 14,
    color: 'rgba(0,0,0,0.6)',
  },
  loginButtonDisabled: {
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  errorText: {
    color: 'red',
    marginBottom: 10,
    fontSize: 12,
  },
    modalCloseButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  modalCloseText: {
    fontWeight: "500",
    color: "rgba(0,0,0,0.8)",
  },
});