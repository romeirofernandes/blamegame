import type { ViewInstance } from "react-native";

export async function shareRecap(
  view: ViewInstance,
  filename = "blame-game-recap.png",
) {
  const { default: capture } = await import("html2canvas-pro");
  const canvas = await capture(view as unknown as HTMLElement, {
    backgroundColor: null,
    scale: 3,
    logging: false,
  });
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((image) =>
      image
        ? resolve(image)
        : reject(new Error("Could not make the recap image.")),
    );
  });
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Blame Game recap" });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      // Rendering the image can outlast the browser's share gesture window.
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
