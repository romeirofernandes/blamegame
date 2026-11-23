import * as Sharing from "expo-sharing";
import { captureRef, releaseCapture } from "react-native-view-shot";
import type { ViewInstance } from "react-native";

export async function shareRecap(
  view: ViewInstance,
  _filename = "blame-game-recap.png",
) {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("Sharing is unavailable.");
  const uri = await captureRef(view, { format: "png", result: "tmpfile" });
  try {
    await Sharing.shareAsync(uri, {
      mimeType: "image/png",
      UTI: "public.png",
      dialogTitle: "Share game recap",
    });
  } finally {
    releaseCapture(uri);
  }
}
