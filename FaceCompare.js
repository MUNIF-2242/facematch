import React, { useState, useEffect } from "react";
import { Button, View, Image, Text, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import AWS from "aws-sdk";

// Configure AWS
AWS.config.update({
  region: process.env.EXPO_PUBLIC_AWS_REGION,
  accessKeyId: process.env.EXPO_PUBLIC_AWS_ACCESS_KEY,
  secretAccessKey: process.env.EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3();
const rekognition = new AWS.Rekognition();

const App = () => {
  const [selfieUri, setSelfieUri] = useState(null);
  const [galleryUri, setGalleryUri] = useState(null);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    (async () => {
      // Request permission to access media library
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission required",
          "We need permission to access your media library to pick an image."
        );
      }
    })();
  }, []);

  const takeSelfie = async () => {
    try {
      let result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      console.log("ImagePicker result:", result); // Log the entire result for debugging

      if (result.canceled) {
        console.log("Selfie capture was canceled");
        Alert.alert("Selfie Canceled", "You canceled the selfie capture.");
        return;
      }

      if (result.assets && result.assets.length > 0) {
        const selfieAsset = result.assets[0];
        const selfieUri = selfieAsset.uri;

        if (selfieUri) {
          console.log("Selfie Image URI:", selfieUri); // Log URI for debugging
          setSelfieUri(selfieUri);
          setStatusMessage("Uploading selfie...");
          setComparisonResult(null);

          // Define the key for the selfie image
          const selfieKey = "selfie.jpg";

          // Call uploadToS3 to upload the selfie image
          try {
            await uploadToS3(selfieUri, selfieKey);
            console.log("Selfie image uploaded to S3");
            setStatusMessage("");
          } catch (error) {
            console.error("Error uploading selfie image:", error);
            Alert.alert(
              "Upload Error",
              `Failed to upload selfie image: ${error.message}`
            );
            setStatusMessage("");
          }
        } else {
          console.log("Selfie image URI is undefined");
          Alert.alert("Error", "Failed to get the selfie image URI.");
        }
      } else {
        console.log("No assets found in ImagePicker result");
        Alert.alert("Error", "No image asset found.");
      }
    } catch (error) {
      console.error("Error taking selfie:", error);
      Alert.alert("Error", `Failed to take a selfie: ${error.message}`);
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    console.log("ImagePicker result:", result); // Log entire result

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const imageAsset = result.assets[0];
      console.log("Gallery Image URI:", imageAsset.uri); // Log URI
      setGalleryUri(imageAsset.uri);
      setStatusMessage("Uploading gallery image...");
      setComparisonResult(null);

      // Upload picked image to S3
      const galleryKey = "gallery.jpg";
      try {
        await uploadToS3(imageAsset.uri, galleryKey);
        console.log("Gallery image uploaded to S3");
        setStatusMessage("");
      } catch (error) {
        console.error("Error uploading gallery image:", error);
        Alert.alert(
          "Upload Error",
          `Failed to upload gallery image: ${error.message}`
        );
        setStatusMessage("");
      }
    } else {
      console.log("Image picking canceled or assets are undefined");
    }
  };

  const bucketName = process.env.EXPO_PUBLIC_AWS_BUCKET_NAME;

  console.log("mybucket" + bucketName);

  const uploadToS3 = async (uri, key) => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();

      console.log(`Uploading ${key} to S3...`);

      const params = {
        Bucket: bucketName,
        Key: key,
        Body: blob,
        ContentType: "image/jpeg",
      };

      const data = await s3.upload(params).promise();
      console.log(`Successfully uploaded ${key}`, data);
    } catch (error) {
      console.error(`Error uploading ${key}:`, error);
      Alert.alert("Upload Error", `Failed to upload ${key}: ${error.message}`);
    }
  };

  const compareFaces = async () => {
    console.log("Selfie URI:", selfieUri);
    console.log("Gallery URI:", galleryUri);
    console.log("comparing image");

    if (selfieUri && galleryUri) {
      const selfieKey = "selfie.jpg";
      const galleryKey = "gallery.jpg";

      try {
        setStatusMessage("Analyzing images...");
        setComparisonResult(null);

        const params = {
          SourceImage: {
            S3Object: {
              Bucket: process.env.EXPO_PUBLIC_AWS_BUCKET_NAME,
              Name: selfieKey,
            },
          },
          TargetImage: {
            S3Object: {
              Bucket: process.env.EXPO_PUBLIC_AWS_BUCKET_NAME,
              Name: galleryKey,
            },
          },
          SimilarityThreshold: 90,
        };

        const response = await rekognition.compareFaces(params).promise();
        console.log(response);
        setComparisonResult(response.FaceMatches.length > 0);
        setStatusMessage("");
      } catch (error) {
        console.error("Error comparing faces:", error);
        Alert.alert(
          "Comparison Error",
          `Failed to compare faces: ${error.message}`
        );
        setStatusMessage("");
      }
    } else {
      Alert.alert(
        "Missing Images",
        "Please take a selfie and pick an image from the gallery."
      );
    }
  };

  return (
    <View
      style={{
        //paddingTop: 120,
        justifyContent: "center",

        alignItems: "center",
        display: "flex",
        height: "100%",
        paddingVertical: 40,
      }}
    >
      <View
        style={{
          justifyContent: "space-between",

          //alignItems: "center",
          display: "flex",
          height: "100%",
        }}
      >
        <View>
          {selfieUri && (
            <Image
              source={{ uri: selfieUri }}
              style={{ width: 200, height: 200, marginVertical: 10 }}
            />
          )}
          <Button title="Take Selfie" onPress={takeSelfie} />
          {galleryUri && (
            <Image
              source={{ uri: galleryUri }}
              style={{ width: 200, height: 200, marginVertical: 10 }}
            />
          )}
          <Button title="Pick Image from Gallery" onPress={pickImage} />
        </View>
        <View>
          {statusMessage ? (
            <Text style={{ marginTop: 20, fontSize: 18 }}>{statusMessage}</Text>
          ) : (
            comparisonResult !== null && (
              <Text style={{ marginTop: 20, fontSize: 18 }}>
                {comparisonResult ? "Faces match!" : "Faces do not match."}
              </Text>
            )
          )}
          <Button title="Compare Faces" onPress={compareFaces} />
        </View>
      </View>
    </View>
  );
};

export default App;
