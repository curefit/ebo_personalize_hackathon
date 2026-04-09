import { useEffect, useMemo, useRef, useState } from "react";
import { generateTryOn } from "../services/apiClient";
import { SIZE_OPTIONS } from "../utils/constants";

const palette = {
  "Electric Blue": "#2563eb",
  Black: "#0f172a",
  "Slate Grey": "#475569",
  "Neon Lime": "#84cc16",
  Graphite: "#374151",
  White: "#f8fafc",
  Sand: "#d6b88d",
  Olive: "#556b2f",
  "Dusty Rose": "#d8a7b1",
  "Ink Navy": "#1e3a8a",
  Clay: "#b45309",
  Crimson: "#dc2626",
  Bone: "#e5e7eb",
  Storm: "#334155",
  "Blue Flame": "#0ea5e9",
  Cobalt: "#1d4ed8",
  Coral: "#fb7185",
  Midnight: "#172554",
  Mist: "#cbd5e1",
  Lilac: "#a78bfa",
  "Off White": "#fefce8",
  Forest: "#166534",
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function ARPreview({ product, onClose }) {
  const defaultSize = useMemo(() => product?.sizes?.[0] || SIZE_OPTIONS[0], [product]);
  const [selectedSize, setSelectedSize] = useState(defaultSize);
  const [colorIndex, setColorIndex] = useState(0);
  const [cameraRequested, setCameraRequested] = useState(false);
  const [cameraState, setCameraState] = useState("idle");
  const [cameraError, setCameraError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [captureCountdown, setCaptureCountdown] = useState(0);
  const [capturedFrame, setCapturedFrame] = useState("");
  const [resultImage, setResultImage] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [framing, setFraming] = useState({ scale: 0.92, offsetY: 0 });
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const framingLoopRef = useRef(null);
  const countdownRef = useRef(null);
  const isGeneratingRef = useRef(false);
  const resultImageRef = useRef("");
  const tryOnAbortControllerRef = useRef(null);
  const closingRef = useRef(false);
  const mountedRef = useRef(false);

  function canUpdateState() {
    return mountedRef.current && !closingRef.current;
  }

  function clearCountdown(resetState = true) {
    if (countdownRef.current) {
      window.clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    if (resetState && mountedRef.current) {
      setCaptureCountdown(0);
    }
  }

  function stopCameraStream() {
    if (framingLoopRef.current) {
      window.clearTimeout(framingLoopRef.current);
      framingLoopRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  function cancelTryOnGeneration() {
    if (!tryOnAbortControllerRef.current) {
      return;
    }

    tryOnAbortControllerRef.current.abort();
    tryOnAbortControllerRef.current = null;
  }

  useEffect(() => {
    isGeneratingRef.current = isGenerating;
  }, [isGenerating]);

  useEffect(() => {
    resultImageRef.current = resultImage;
  }, [resultImage]);

  useEffect(() => {
    mountedRef.current = true;
    closingRef.current = false;
    return () => {
      closingRef.current = true;
      mountedRef.current = false;
      clearCountdown(false);
      cancelTryOnGeneration();
      stopCameraStream();
    };
  }, []);

  useEffect(() => {
    closingRef.current = false;
    cancelTryOnGeneration();
    setSelectedSize(defaultSize);
    setColorIndex(0);
    setCameraRequested(false);
    setCameraState("idle");
    setCameraError("");
    setIsGenerating(false);
    setCaptureCountdown(0);
    setCapturedFrame("");
    setResultImage("");
    setGenerationError("");
    setFraming({ scale: 0.92, offsetY: 0 });
  }, [defaultSize, product]);

  useEffect(() => {
    if (!product || !cameraRequested) {
      return undefined;
    }

    let cancelled = false;
    let stopFraming = () => {};

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled && canUpdateState()) {
          setCameraState("error");
          setCameraError("Camera preview is not supported in this browser.");
        }
        return;
      }

      if (canUpdateState()) {
        setCameraState("loading");
        setCameraError("");
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            resizeMode: "crop-and-scale",
            width: { ideal: 1080 },
            height: { ideal: 1350 },
            aspectRatio: { ideal: 0.8 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const [track] = stream.getVideoTracks();
        const capabilities = track?.getCapabilities?.() || {};
        if (capabilities.focusMode) {
          track.applyConstraints({ advanced: [{ focusMode: "continuous" }] }).catch(() => {});
        }
        if (capabilities.zoom && typeof capabilities.zoom.min === "number") {
          track
            .applyConstraints({
              advanced: [
                {
                  zoom: capabilities.zoom.min,
                },
              ],
            })
            .catch(() => {});
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        if (!canUpdateState()) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        setCameraState("ready");
        stopFraming = startSmartFraming(track);
      } catch (error) {
        if (!cancelled && canUpdateState()) {
          setCameraState("error");
          setCameraError("Camera access was blocked. Allow camera permission to continue.");
        }
      }
    }

    function startSmartFraming(track) {
      const FaceDetectorAPI = window.FaceDetector;
      if (!FaceDetectorAPI || !videoRef.current) {
        return;
      }

      const detector = new FaceDetectorAPI({ fastMode: true, maxDetectedFaces: 1 });
      const video = videoRef.current;
      const capabilities = track?.getCapabilities?.() || {};
      let active = true;

      const tick = async () => {
        if (!active || !video.videoWidth || !video.videoHeight || resultImageRef.current || isGeneratingRef.current) {
          framingLoopRef.current = window.setTimeout(tick, 700);
          return;
        }

        try {
          const faces = await detector.detect(video);
          const face = faces?.[0];

          if (face?.boundingBox) {
            const { width, y, height } = face.boundingBox;
            const faceRatio = width / video.videoWidth;
            const centerY = (y + height / 2) / video.videoHeight;
            const scale = clamp(0.92 + (0.14 - faceRatio) * 0.85, 0.88, 1.02);
            const offsetY = clamp((0.27 - centerY) * 110, -38, 22);
            if (canUpdateState()) {
              setFraming({ scale, offsetY });
            }

            if (capabilities.zoom && typeof capabilities.zoom.min === "number" && typeof capabilities.zoom.max === "number") {
              const zoomProgress = clamp((0.11 - faceRatio) / 0.07, 0, 1);
              const zoomTarget =
                capabilities.zoom.min + zoomProgress * (capabilities.zoom.max - capabilities.zoom.min) * 0.12;
              track.applyConstraints({ advanced: [{ zoom: zoomTarget }] }).catch(() => {});
            }
          }
        } catch {
          // Ignore best-effort framing failures.
        }

        framingLoopRef.current = window.setTimeout(tick, 700);
      };

      tick();

      return () => {
        active = false;
        if (framingLoopRef.current) {
          window.clearTimeout(framingLoopRef.current);
          framingLoopRef.current = null;
        }
      };
    }

    startCamera();

    return () => {
      cancelled = true;
      stopFraming();
      stopCameraStream();
      clearCountdown();
    };
  }, [cameraRequested, product]);

  if (!product) {
    return null;
  }

  const activeColor = product.colors[colorIndex];
  const fill = palette[activeColor] || "#2563eb";

  function rotateColor(direction) {
    const total = product.colors.length;
    setColorIndex((current) => (current + direction + total) % total);
  }

  function captureFrame() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      throw new Error("Camera frame is not ready.");
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/jpeg", 0.94);
  }

  async function handleTryOn() {
    const abortController = new AbortController();
    tryOnAbortControllerRef.current = abortController;

    try {
      setGenerationError("");
      setIsGenerating(true);
      const personImage = captureFrame();
      setCapturedFrame(personImage);
      const payload = await generateTryOn({
        personImage,
        referenceImage: product.image_url,
        productName: product.name,
        color: activeColor,
        size: selectedSize,
        material: product.material,
        fit: product.fit,
      }, { signal: abortController.signal });

      if (abortController.signal.aborted || closingRef.current) {
        return;
      }

      setResultImage(payload.result.imageUrl);
    } catch (error) {
      if (error.name === "AbortError" || abortController.signal.aborted || closingRef.current) {
        return;
      }

      setGenerationError(error.message);
    } finally {
      if (tryOnAbortControllerRef.current === abortController) {
        tryOnAbortControllerRef.current = null;
      }

      if (!abortController.signal.aborted && canUpdateState()) {
        setIsGenerating(false);
      }
    }
  }

  function handleCaptureStart() {
    if (cameraState !== "ready" || isGenerating) {
      return;
    }

    setGenerationError("");
    clearCountdown();
    setCaptureCountdown(3);

    countdownRef.current = window.setInterval(() => {
      setCaptureCountdown((current) => {
        if (current <= 1) {
          clearCountdown();
          window.setTimeout(() => {
            if (canUpdateState()) {
              handleTryOn();
            }
          }, 80);
          return 0;
        }

        return current - 1;
      });
    }, 1000);
  }

  return (
    <section className="overlay-shell ar-shell">
      <div className="overlay-card ar-panel">
        <button
          type="button"
          className="close-button"
          onClick={() => {
            closingRef.current = true;
            clearCountdown();
            cancelTryOnGeneration();
            stopCameraStream();
            onClose();
          }}
          aria-label="Close AR preview"
        >
          ×
        </button>

        <div className="ar-copy">
          <span className="eyebrow">Try-On Preview</span>
          <h2>{product.name}</h2>
          <p>Take one clear picture and we will fit the selected T-shirt onto your body.</p>
        </div>

        <div className="ar-stage">
          <div className="camera-shell">
            {resultImage ? (
              <img src={resultImage} alt={`${product.name} try-on result`} className="camera-feed result-feed" />
            ) : capturedFrame ? (
              <img src={capturedFrame} alt="Captured frame" className="camera-feed result-feed captured-feed" />
            ) : (
              <video
                ref={videoRef}
                className="camera-feed live-camera-feed"
                muted
                playsInline
                style={{
                  transform: `translateY(${framing.offsetY}px) scale(${framing.scale}) scaleX(-1)`,
                  transformOrigin: "center center",
                }}
              />
            )}

            {!cameraRequested ? (
              <div className="camera-overlay camera-message camera-consent">
                <strong>Camera will open for body framing.</strong>
                <p>Stand 4-6 feet away so your head, shoulders, and torso fit inside the frame.</p>
                <div className="consent-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      closingRef.current = true;
                      clearCountdown();
                      cancelTryOnGeneration();
                      stopCameraStream();
                      onClose();
                    }}
                  >
                    Cancel
                  </button>
                  <button type="button" className="primary-button" onClick={() => setCameraRequested(true)}>
                    Yes, Open Camera
                  </button>
                </div>
              </div>
            ) : null}

            {cameraRequested && cameraState !== "ready" && !resultImage ? (
              <div className="camera-overlay camera-message">
                <strong>{cameraState === "loading" ? "Opening camera..." : "Camera unavailable"}</strong>
                <p>{cameraError || "Waiting for camera permission."}</p>
              </div>
            ) : null}

            {cameraRequested && !resultImage && cameraState === "ready" ? (
              <div className="camera-overlay">
                <div className="fit-frame">
                  <div className="fit-frame-copy">
                    <strong>Fit your upper body inside this frame</strong>
                    <span>Smart framing will adjust as you move.</span>
                  </div>
                </div>
              </div>
            ) : null}

            {isGenerating ? (
              <div className="camera-overlay camera-message">
                <strong>Generating your try-on...</strong>
                <p>Applying the selected T-shirt to your captured photo.</p>
              </div>
            ) : null}

            {captureCountdown > 0 && !isGenerating ? (
              <div className="camera-overlay camera-message countdown-message">
                <strong>{captureCountdown}</strong>
                <p>Hold still. Capturing your photo.</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="ar-controls ar-controls-compact">
          <label className="field compact-field">
            <span>Size</span>
            <select value={selectedSize} onChange={(event) => setSelectedSize(event.target.value)}>
              {product.sizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>

          <div className="color-rotator">
            <span>Color</span>
            <div className="rotator-controls">
              <button type="button" className="ghost-button" onClick={() => rotateColor(-1)}>
                Prev
              </button>
              <div className="active-color">
                <span className="color-dot" style={{ backgroundColor: fill }} />
                <strong>{activeColor}</strong>
              </div>
              <button type="button" className="ghost-button" onClick={() => rotateColor(1)}>
                Next
              </button>
            </div>
          </div>

          <div className="tryon-actions">
            {!resultImage ? (
              <button
                type="button"
                className="primary-button"
                disabled={cameraState !== "ready" || isGenerating || captureCountdown > 0}
                onClick={handleCaptureStart}
              >
                {captureCountdown > 0 ? `Capturing in ${captureCountdown}` : isGenerating ? "Generating..." : "Take Picture"}
              </button>
            ) : (
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setCapturedFrame("");
                  setResultImage("");
                  setGenerationError("");
                }}
              >
                Retake
              </button>
            )}
          </div>
        </div>

        {generationError ? <p className="form-error tryon-error">{generationError}</p> : null}
      </div>
    </section>
  );
}
