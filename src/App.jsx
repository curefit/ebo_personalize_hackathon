import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import AdminConsole from "./components/AdminConsole";
import ARPreview from "./components/ARPreview";
import AppErrorBoundary from "./components/AppErrorBoundary";
import MemberLogin from "./components/MemberLogin";
import NonMemberQuestions from "./components/NonMemberQuestions";
import ProductDetails from "./components/ProductDetails";
import ProductGrid from "./components/ProductGrid";
import ToyMascotStudio from "./components/ToyMascotStudio";
import { fetchExperience, fetchProducts, fetchRecommendations, loginMember } from "./services/apiClient";
import {
  ACTIVITY_OPTIONS,
  APP_COPY,
  BUDGET_OPTIONS,
  FIT_OPTIONS,
  GENDER_OPTIONS,
  MATERIAL_OPTIONS,
  MEMBER_OPTIONS,
  SESSION_GOAL_OPTIONS,
} from "./utils/constants";
import { matchesIntentFilters, parseShopperIntent, scoreProductIntentMatch } from "./utils/queryIntent.js";
import { buildGuestName, getInitials, normalizePhoneNumber } from "./utils/helpers";

function buildGuestProfile(answers) {
  const workoutToActivity = {
    "Cardio (running, cycling)": "Running",
    "Strength (weights, resistance)": "Gym",
    "Flexibility (yoga, Pilates)": "Yoga",
    "Sports (football, tennis, etc.)": "Sports",
    Others: "Casual",
  };
  const styleToFit = {
    "Function first": "Lightweight",
    "Style first": "Regular",
    "Both equally": "Regular",
  };
  const discomfortToMaterial = {
    "Foot/leg discomfort": "Moisture-wicking",
    "Back/shoulder pain": "Blend",
    "No issues": "Cotton",
    Others: "Breathable",
  };
  const companyToGoal = {
    Alone: "Train hard",
    "With a friend/partner": "Complete look",
    "Group classes": "Studio ease",
  };
  const normalizedGender = answers.gender === "Female" ? "Women" : answers.gender === "Male" ? "Men" : "Any";
  const resolvedActivity = workoutToActivity[answers.workout_type] || "Casual";
  const resolvedFit = styleToFit[answers.style_priority] || "Regular";
  const resolvedMaterial = discomfortToMaterial[answers.discomfort] || "Breathable";
  const resolvedGoal = companyToGoal[answers.workout_company] || "Train hard";
  const styleNote = [
    answers.discomfort ? `Discomfort: ${answers.discomfort}` : "",
    answers.style_priority ? `Preference: ${answers.style_priority}` : "",
    answers.workout_company ? `Workout mode: ${answers.workout_company}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    ...answers,
    activity: resolvedActivity,
    preferred_fit: resolvedFit,
    material_preference: resolvedMaterial,
    session_goal: resolvedGoal,
    budget_band: "Balanced",
    gender: normalizedGender,
    userType: "guest",
    name: buildGuestName(resolvedActivity),
    style_note: styleNote,
    fitness_level: "Walk-in",
  };
}

function buildMemberProfile(member) {
  return {
    ...member,
    gender: member.gender || "Any",
    userType: "member",
    session_goal: member.session_goal || "Train hard",
    climate_preference: member.climate_preference || "Allweather",
    budget_band: member.budget_band || "Balanced",
  };
}

function buildBrowseStatusMessage({
  recommendationsLoading,
  catalogLoading,
  recommendationsError,
  catalogError,
  recommendations,
  catalogResults,
}) {
  const hasRecommendations = recommendations.length > 0;
  const hasCatalogResults = catalogResults.length > 0;

  if (recommendationsLoading && catalogLoading) {
    return "Refreshing the rack and the recommendations...";
  }

  if (recommendationsLoading) {
    return "Refreshing recommendations...";
  }

  if (catalogLoading) {
    return "Filtering the rack...";
  }

  if (recommendationsError && catalogError) {
    return hasRecommendations || hasCatalogResults
      ? "Showing the current rack while refresh retries."
      : "Rack refresh is paused for now.";
  }

  if (recommendationsError) {
    return hasRecommendations ? "Showing the current rack while recommendations retry." : "Recommendations are paused for now.";
  }

  if (catalogError) {
    return hasCatalogResults ? "Showing the last filtered rack while catalog refresh retries." : "Catalog refresh is paused for now.";
  }

  return "";
}

function matchesSearch(product, query) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  const haystack = [
    product?.name,
    product?.category,
    product?.description,
    product?.material,
    product?.material_tag,
    ...(product?.colors || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

function normalizeGenderValue(value = "") {
  const normalized = String(value || "").trim().toLowerCase();

  if (["men", "male", "man"].includes(normalized)) {
    return "Men";
  }

  if (["women", "female", "woman", "lady"].includes(normalized)) {
    return "Women";
  }

  return "Any";
}

function hasMasculineMarkers(value = "") {
  const text = String(value || "").toLowerCase();
  return /\b(men|men's|mens|male|man|gents|gent)\b/.test(text);
}

function hasFeminineMarkers(value = "") {
  const text = String(value || "").toLowerCase();
  return /\b(women|women's|womens|female|woman|ladies|lady|girl|girls)\b/.test(text);
}

function isGenderCompatible(product, profileGender) {
  const preferred = normalizeGenderValue(profileGender);
  if (preferred === "Any") {
    return true;
  }

  const productText = `${product?.name || ""} ${product?.category || ""}`.toLowerCase();
  if (preferred === "Women" && hasMasculineMarkers(productText)) {
    return false;
  }
  if (preferred === "Men" && productText.includes("tregging")) {
    return false;
  }
  if (preferred === "Men" && hasFeminineMarkers(productText)) {
    return false;
  }

  const productGender = normalizeGenderValue(product?.gender);
  return productGender === preferred;
}

function buildArSessionPool(activeProduct, sourceProducts = [], maxFollowUps = 5) {
  if (!activeProduct?.id) {
    return [];
  }

  const maxPoolSize = maxFollowUps + 1;
  const pool = [activeProduct];
  const seen = new Set([activeProduct.id]);

  for (const candidate of sourceProducts) {
    if (!candidate?.id || seen.has(candidate.id)) {
      continue;
    }

    seen.add(candidate.id);
    pool.push(candidate);

    if (pool.length >= maxPoolSize) {
      break;
    }
  }

  return pool;
}

export default function App() {
  const view = new URLSearchParams(window.location.search).get("view");
  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
  const showToyStudio = view === "toy";
  const showAdminConsole = pathname === "/admin" || view === "admin";
  const [screen, setScreen] = useState("landing");
  const [experience, setExperience] = useState(null);
  const [experienceStatus, setExperienceStatus] = useState("loading");
  const [shopperProfile, setShopperProfile] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [profileSummary, setProfileSummary] = useState(null);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState("");
  const [catalogResults, setCatalogResults] = useState([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [refineDraft, setRefineDraft] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [arProduct, setArProduct] = useState(null);
  const [arOpenNonce, setArOpenNonce] = useState(0);
  const [previewCacheByProductId, setPreviewCacheByProductId] = useState({});
  const [activeTryOnPoster, setActiveTryOnPoster] = useState("");
  const [arSessionPool, setArSessionPool] = useState([]);
  const [pendingMember, setPendingMember] = useState(null);
  const [memberLookupLoading, setMemberLookupLoading] = useState(false);
  const [memberVerifyLoading, setMemberVerifyLoading] = useState(false);
  const [memberError, setMemberError] = useState("");
  const memberLookupRequestRef = useRef(null);
  const memberLookupRequestIdRef = useRef(0);
  const speechRecognitionRef = useRef(null);
  const deferredSearch = useDeferredValue(catalogSearch);
  const deferredProfile = useDeferredValue(shopperProfile);
  const searchIntent = useMemo(() => parseShopperIntent(deferredSearch), [deferredSearch]);
  const shouldUseIntentDrivenCatalogSearch = useMemo(
    () =>
      Boolean(
        deferredSearch.trim() &&
          (searchIntent.gender ||
            searchIntent.activity ||
            searchIntent.preferred_fit ||
            searchIntent.material_preference ||
            searchIntent.categories?.length ||
            searchIntent.colors?.length),
      ),
    [deferredSearch, searchIntent.activity, searchIntent.categories, searchIntent.colors, searchIntent.gender, searchIntent.material_preference, searchIntent.preferred_fit],
  );
  const speechRecognitionSupported = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    let isMounted = true;
    setExperienceStatus("loading");

    async function loadExperience() {
      try {
        const payload = await fetchExperience();
        if (!isMounted) {
          return;
        }

        setExperience(payload);
        setExperienceStatus("ready");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setExperience(null);
        setExperienceStatus("fallback");
      }
    }

    loadExperience();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (screen === "browse") {
      return;
    }

    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.onresult = null;
      speechRecognitionRef.current.onerror = null;
      speechRecognitionRef.current.onend = null;
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
    }

    setIsListening(false);
  }, [screen]);

  useEffect(() => {
    if (!deferredProfile) {
      setRecommendations([]);
      setProfileSummary(null);
      return;
    }

    let isMounted = true;
    setRecommendationsLoading(true);
    setRecommendationsError("");

    fetchRecommendations(deferredProfile, 10)
      .then((payload) => {
        if (!isMounted) {
          return;
        }

        setRecommendations(payload.recommendations || []);
        setProfileSummary(payload.profileSummary || null);
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setRecommendationsError(error.message);
      })
      .finally(() => {
        if (isMounted) {
          setRecommendationsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [deferredProfile]);

  useEffect(() => {
    setRefineDraft(shopperProfile?.style_note || "");
  }, [shopperProfile?.style_note]);

  useEffect(
    () => () => {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.onresult = null;
        speechRecognitionRef.current.onerror = null;
        speechRecognitionRef.current.onend = null;
        speechRecognitionRef.current.stop();
        speechRecognitionRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    if (screen !== "browse") {
      return;
    }

    let isMounted = true;
    setCatalogLoading(true);
    setCatalogError("");

    fetchProducts({
      limit: deferredSearch.trim() ? 48 : 12,
      search: shouldUseIntentDrivenCatalogSearch ? "" : deferredSearch,
      activity: searchIntent.activity || (deferredSearch.trim() ? "" : shopperProfile?.activity),
      fit: searchIntent.preferred_fit || "",
      material: searchIntent.material_preference || "",
      category: searchIntent.categories?.[0] || "",
      gender: searchIntent.gender || shopperProfile?.gender || "",
    })
      .then((payload) => {
        if (!isMounted) {
          return;
        }

        setCatalogResults(payload.products || []);
        setCatalogTotal(payload.total || 0);
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setCatalogError(error.message);
      })
      .finally(() => {
        if (isMounted) {
          setCatalogLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [
    deferredSearch,
    screen,
    searchIntent.activity,
    searchIntent.categories,
    searchIntent.gender,
    searchIntent.material_preference,
    searchIntent.preferred_fit,
    shopperProfile?.activity,
    shopperProfile?.gender,
    shouldUseIntentDrivenCatalogSearch,
  ]);

  function handleMemberOtpRequest(rawPhone) {
    const phone = normalizePhoneNumber(rawPhone);
    if (phone.length !== 10) {
      setMemberError("Enter a valid 10-digit phone number.");
      return;
    }

    memberLookupRequestIdRef.current += 1;
    const requestId = memberLookupRequestIdRef.current;
    setPendingMember(null);
    setMemberError("");
    setMemberLookupLoading(true);

    const request = loginMember(phone)
      .then((payload) => {
        const member = buildMemberProfile(payload.member);
        if (memberLookupRequestIdRef.current === requestId) {
          setPendingMember(member);
        }
        return { ok: true, member };
      })
      .catch((error) => {
        if (memberLookupRequestIdRef.current === requestId) {
          setMemberError(error.message);
          setPendingMember(null);
        }

        return { ok: false, error };
      })
      .finally(() => {
        if (memberLookupRequestIdRef.current === requestId) {
          setMemberLookupLoading(false);
          memberLookupRequestRef.current = null;
        }
      });

    memberLookupRequestRef.current = request;
  }

  function setJourneyScreen(nextScreen) {
    if (nextScreen !== "browse") {
      setSelectedProduct(null);
      setArProduct(null);
      setActiveTryOnPoster("");
      setPreviewCacheByProductId({});
      setArSessionPool([]);
    }

    startTransition(() => setScreen(nextScreen));
  }

  async function handleMemberOtpVerify() {
    setMemberError("");
    setMemberVerifyLoading(true);

    let resolvedMember = pendingMember;

    if (!resolvedMember && memberLookupRequestRef.current) {
      const result = await memberLookupRequestRef.current;
      if (!result?.ok) {
        setMemberVerifyLoading(false);
        return;
      }

      resolvedMember = result.member;
    }

    if (!resolvedMember) {
      setMemberVerifyLoading(false);
      setMemberError("Member lookup expired. Enter the phone number again.");
      return;
    }

    setShopperProfile(resolvedMember);
    setPendingMember(null);
    setMemberVerifyLoading(false);
    setJourneyScreen("browse");
  }

  function handleGuestComplete(answers) {
    setShopperProfile(buildGuestProfile(answers));
    setJourneyScreen("browse");
  }

  function updateProfileField(field, value) {
    setShopperProfile((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        [field]: value,
      };
    });
  }

  function applyRefineDraft() {
    const nextValue = refineDraft.trim();
    setVoiceFeedback(nextValue ? `Refining for: ${nextValue}` : "");
    setVoiceError("");
    if (nextValue === (shopperProfile?.style_note || "")) {
      return;
    }

    updateProfileField("style_note", nextValue);
  }

  function stopVoiceCapture() {
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.onresult = null;
      speechRecognitionRef.current.onerror = null;
      speechRecognitionRef.current.onend = null;
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
    }

    setIsListening(false);
  }

  function toggleVoiceCapture() {
    if (!speechRecognitionSupported) {
      setVoiceError("Voice input is not supported in this browser.");
      return;
    }

    if (isListening && speechRecognitionRef.current) {
      stopVoiceCapture();
      return;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = speechRecognitionRef.current || new Recognition();
    let latestTranscript = "";

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = "en-IN";
    setVoiceError("");
    setVoiceFeedback("Listening for a product brief...");

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .join(" ")
        .trim();

      if (transcript) {
        latestTranscript = transcript;
        setRefineDraft(transcript);
        setVoiceFeedback(`Heard: ${transcript}`);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setVoiceError("Microphone access is blocked. Allow mic access and try again.");
      } else if (event.error === "no-speech") {
        setVoiceError("I didn't catch that. Try speaking again.");
      } else {
        setVoiceError("Voice capture failed. Try again or type the brief.");
      }
      setVoiceFeedback("");
      setIsListening(false);
    };

    recognition.onend = () => {
      if (latestTranscript) {
        updateProfileField("style_note", latestTranscript);
        setVoiceFeedback(`Applied voice brief: ${latestTranscript}`);
      } else if (!voiceError) {
        setVoiceFeedback("");
      }
      setIsListening(false);
    };

    speechRecognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  }

  function resetJourney() {
    memberLookupRequestIdRef.current += 1;
    memberLookupRequestRef.current = null;
    stopVoiceCapture();
    setShopperProfile(null);
    setPendingMember(null);
    setMemberError("");
    setRecommendations([]);
    setRecommendationsLoading(false);
    setRecommendationsError("");
    setProfileSummary(null);
    setCatalogResults([]);
    setCatalogTotal(0);
    setCatalogSearch("");
    setCatalogLoading(false);
    setCatalogError("");
    setSelectedProduct(null);
    setArProduct(null);
    setArOpenNonce(0);
    setPreviewCacheByProductId({});
    setActiveTryOnPoster("");
    setArSessionPool([]);
    setMemberLookupLoading(false);
    setMemberVerifyLoading(false);
    setJourneyScreen("landing");
  }

  function handleOpenDetails(product) {
    setSelectedProduct(product);
  }

  function closeArPanel() {
    setArProduct(null);
    setArOpenNonce((current) => current + 1);
    setPreviewCacheByProductId({});
    setActiveTryOnPoster("");
    setArSessionPool([]);
  }

  function handleOpenAR(product, options = {}) {
    const { reusePoster = false } = options;
    setSelectedProduct(null);
    const sourceProducts = visibleRecommendations.length ? visibleRecommendations : visibleCatalogResults;

    if (!reusePoster) {
      setPreviewCacheByProductId({});
      setActiveTryOnPoster("");
      setArSessionPool(buildArSessionPool(product, sourceProducts, 5));
    } else {
      setArSessionPool((current) => {
        if (!current.length) {
          return buildArSessionPool(product, sourceProducts, 5);
        }

        if (current.some((item) => item?.id === product?.id)) {
          return current;
        }

        const appended = [...current, product].filter((item) => item?.id);
        return appended.slice(0, 6);
      });
    }
    setArOpenNonce((current) => current + 1);
    setArProduct(product);
  }

  function handlePreviewComplete(product, imageUrl) {
    if (!product?.id) {
      return;
    }

    if (imageUrl) {
      setPreviewCacheByProductId((current) => {
        if (current[product.id] === imageUrl) {
          return current;
        }

        return {
          ...current,
          [product.id]: imageUrl,
        };
      });
    }
  }

  const leadProduct = recommendations[0] || null;
  const activityChoices = useMemo(
    () => [...new Set([shopperProfile?.activity, ...(experience?.activities || []), ...ACTIVITY_OPTIONS].filter(Boolean))],
    [experience?.activities, shopperProfile?.activity],
  );
  const visibleRecommendations = useMemo(
    () =>
      [...recommendations]
        .filter((product) => {
          if (!isGenderCompatible(product, shopperProfile?.gender)) {
            return false;
          }

          if (!matchesIntentFilters(product, searchIntent)) {
            return false;
          }

          return matchesSearch(product, deferredSearch) || scoreProductIntentMatch(product, searchIntent, deferredSearch) > 0;
        })
        .sort((left, right) => Number(left.ranking || 9999) - Number(right.ranking || 9999)),
    [deferredSearch, recommendations, searchIntent, shopperProfile?.gender],
  );
  const visibleCatalogResults = useMemo(() => {
    if (!deferredSearch.trim()) {
      return catalogResults.filter((product) => isGenderCompatible(product, shopperProfile?.gender));
    }

    return [...catalogResults]
      .map((product) => ({
        product,
        matchScore: scoreProductIntentMatch(product, searchIntent, deferredSearch),
      }))
      .filter(
        ({ product, matchScore }) =>
          isGenderCompatible(product, shopperProfile?.gender) && (matchesSearch(product, deferredSearch) || matchScore > 0),
      )
      .sort((left, right) => right.matchScore - left.matchScore)
      .map(({ product }) => product);
  }, [catalogResults, deferredSearch, searchIntent, shopperProfile?.gender]);
  const arFollowUpProducts = useMemo(() => {
    if (!arProduct) {
      return [];
    }

    if (arSessionPool.length) {
      return arSessionPool.filter((product) => product?.id && product.id !== arProduct.id).slice(0, 5);
    }

    const sourceProducts = visibleRecommendations.length ? visibleRecommendations : visibleCatalogResults;
    return sourceProducts.filter((product) => product?.id && product.id !== arProduct.id).slice(0, 5);
  }, [arProduct, arSessionPool, visibleCatalogResults, visibleRecommendations]);
  const isLandingScreen = screen === "landing";
  const isMemberScreen = screen === "member";
  const isGuestScreen = screen === "guest";
  const isBrowseScreen = screen === "browse";
  const tryOnLive = experience?.tryOn === "openrouter";
  const browseStatusMessage = useMemo(
    () =>
      buildBrowseStatusMessage({
        recommendationsLoading,
        catalogLoading,
        recommendationsError,
        catalogError,
        recommendations,
        catalogResults,
      }),
    [catalogError, catalogLoading, catalogResults, recommendations, recommendationsError, recommendationsLoading],
  );

  if (showToyStudio) {
    return <ToyMascotStudio />;
  }

  if (showAdminConsole) {
    return <AdminConsole />;
  }

  return (
    <main className="app-shell">
      <div className="hero-noise hero-noise-a" />
      <div className="hero-noise hero-noise-b" />

      <header className="site-header">
        <div className="brand-lockup">
          <div className="brand-mark">{getInitials(shopperProfile?.name || APP_COPY.brand)}</div>
          <div className="brand-copy">
            <strong>{APP_COPY.brand} Personalize</strong>
            <span>{experience?.currentStore?.store_name || "In-store styling console"}</span>
          </div>
        </div>

        <div className="header-meta">
          {experienceStatus === "loading" ? <span className="mini-pill">Loading brief</span> : null}
          {experienceStatus === "fallback" ? <span className="mini-pill">Using fallback data</span> : null}
          {experience ? <span className="mini-pill">{experience.mode === "catalog-db" ? "Live catalog" : "Store brief"}</span> : null}
          {tryOnLive ? <span className="mini-pill">Try-on live</span> : null}
        </div>
      </header>

      {!isBrowseScreen ? (
        <section className="onboarding-shell">
          <div className="onboarding-hero">
            <div className="landing-copy">
              <span className="eyebrow">{APP_COPY.heroEyebrow}</span>
              <h1>{APP_COPY.heroTitle}</h1>
              <p>{APP_COPY.heroSubtitle}</p>
            </div>

          </div>

          <div className="onboarding-flow">
            <div className="launch-options">
              {MEMBER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`launch-option ${screen === option.value ? "is-active" : ""}`}
                  onClick={() => setJourneyScreen(option.value)}
                >
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </button>
              ))}
            </div>

            {isLandingScreen ? (
              <section className="flow-placeholder">
                <span className="eyebrow">Guided flow</span>
                <h2>Select member or guest to continue.</h2>
                <p>The next panel opens here instantly so the associate can proceed without scrolling.</p>
              </section>
            ) : null}

            {isMemberScreen ? (
              <MemberLogin
                onBack={() => setJourneyScreen("landing")}
                onRequestOtp={handleMemberOtpRequest}
                onVerifyOtp={handleMemberOtpVerify}
                requestLoading={memberLookupLoading}
                verifyLoading={memberVerifyLoading}
                error={memberError}
              />
            ) : null}

            {isGuestScreen ? (
              <NonMemberQuestions onBack={() => setJourneyScreen("landing")} onComplete={handleGuestComplete} />
            ) : null}
          </div>
        </section>
      ) : (
        <section className="workspace-shell">
          <aside className="workspace-sidebar">
            <div className="workspace-panel profile-panel">
              <span className="eyebrow">Live brief</span>
              <h2>{profileSummary?.headline || `${shopperProfile?.name}'s edit`}</h2>
              <p>{profileSummary?.subline || "Refine the signals and re-rank the rack instantly."}</p>

              <div className="profile-edit-grid">
                <label className="field">
                  <span>Gender</span>
                  <select value={shopperProfile?.gender || "Any"} onChange={(event) => updateProfileField("gender", event.target.value)}>
                    {GENDER_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Activity</span>
                  <select value={shopperProfile?.activity || ""} onChange={(event) => updateProfileField("activity", event.target.value)}>
                    {activityChoices.map((activity) => (
                      <option key={activity} value={activity}>
                        {activity}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Fit</span>
                  <select
                    value={shopperProfile?.preferred_fit || ""}
                    onChange={(event) => updateProfileField("preferred_fit", event.target.value)}
                  >
                    {FIT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Fabric</span>
                  <select
                    value={shopperProfile?.material_preference || ""}
                    onChange={(event) => updateProfileField("material_preference", event.target.value)}
                  >
                    {MATERIAL_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Goal</span>
                  <select value={shopperProfile?.session_goal || ""} onChange={(event) => updateProfileField("session_goal", event.target.value)}>
                    {SESSION_GOAL_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Budget</span>
                  <select value={shopperProfile?.budget_band || ""} onChange={(event) => updateProfileField("budget_band", event.target.value)}>
                    {BUDGET_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="brief-actions">
                <button type="button" className="ghost-button" onClick={resetJourney}>
                  New shopper
                </button>
              </div>
            </div>
          </aside>

          <div className="workspace-main">
            <section className="workspace-top">
              <section className="workspace-summary">
                <div className="summary-copy">
                  <span className="eyebrow">{APP_COPY.browseTitle}</span>
                  <h1>{profileSummary?.headline || "Rack ready"}</h1>
                  <p>{profileSummary?.subline || APP_COPY.browseSubtitle}</p>
                </div>

                {leadProduct ? (
                  <button type="button" className="summary-product" onClick={() => setSelectedProduct(leadProduct)}>
                    <img src={leadProduct.image_url} alt={leadProduct.name} />
                    <span className="summary-product-copy">
                      <strong>{leadProduct.name}</strong>
                      <small>{leadProduct.recommendationReason || "Current strongest match"}</small>
                    </span>
                  </button>
                ) : (
                  <div className="summary-placeholder">
                    <strong>Ranking the first set</strong>
                    <span>The rack will settle once the active brief finishes loading.</span>
                  </div>
                )}
              </section>

              <div className="refine-row">
                <label className="search-field">
                  <span>Search catalog</span>
                  <input
                    type="search"
                    value={catalogSearch}
                    placeholder="Search by name, fabric, or use case"
                    onChange={(event) => setCatalogSearch(event.target.value)}
                  />
                </label>

                <div className="refine-composer">
                  <div className="search-field voice-search-field">
                    <span>Refine by text or voice</span>
                    <input
                      type="text"
                      value={refineDraft}
                      placeholder="e.g. dark breathable tees"
                      onChange={(event) => setRefineDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          applyRefineDraft();
                        }
                      }}
                    />
                    {isListening ? (
                      <div className="voice-indicator" role="status" aria-live="polite">
                        <span className="voice-indicator-copy">Listening now. Speak your product brief, then tap stop.</span>
                        <span className="voice-wave" aria-hidden="true">
                          <i />
                          <i />
                          <i />
                          <i />
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div className="refine-actions">
                    <button
                      type="button"
                      className={`ghost-button ${isListening ? "is-listening" : ""}`}
                      onClick={toggleVoiceCapture}
                      disabled={!speechRecognitionSupported}
                      aria-pressed={isListening}
                    >
                      {isListening ? "Stop listening" : "Voice"}
                    </button>
                    <button type="button" className="primary-button" onClick={applyRefineDraft}>
                      Apply
                    </button>
                  </div>
                </div>
              </div>

              {browseStatusMessage ? <p className="loading-copy">{browseStatusMessage}</p> : null}
              {voiceFeedback ? <p className="loading-copy">{voiceFeedback}</p> : null}
              {voiceError ? <p className="form-error">{voiceError}</p> : null}
            </section>

            <section className="workspace-list-scroll">
              <ProductGrid
                className="catalog-section--compact"
                title="Recommended for you"
                subtitle={
                  deferredSearch
                    ? `Showing ${visibleRecommendations.length} recommendation${visibleRecommendations.length === 1 ? "" : "s"} for "${deferredSearch}".`
                    : "These picks are ranked to your profile, cohort, and gender."
                }
                products={visibleRecommendations}
                onOpenDetails={handleOpenDetails}
                onOpenAR={handleOpenAR}
                emptyCopy="No strong matches yet. Try a small refinement."
              />

              <ProductGrid
                className="catalog-section--compact"
                title={`Showing ${visibleCatalogResults.length} of ${catalogTotal || catalogResults.length}`}
                subtitle="Use this rail for alternatives, safer options, or a second opinion."
                products={visibleCatalogResults}
                onOpenDetails={handleOpenDetails}
                onOpenAR={handleOpenAR}
                emptyCopy="No catalog results matched that search."
              />
            </section>
          </div>
        </section>
      )}

      <ProductDetails product={selectedProduct} onBack={() => setSelectedProduct(null)} onOpenAR={handleOpenAR} />

      <AppErrorBoundary
        resetKey={`${arProduct?.id || "no-ar-product"}:${arOpenNonce}`}
        fallback={(error) =>
          arProduct ? (
            <section className="overlay-shell">
              <div className="overlay-card detail-panel">
                <h2>Preview unavailable</h2>
                <p>The try-on panel closed unexpectedly. Return to the rack and try again.</p>
                {error?.message ? <p className="form-error">Error: {error.message}</p> : null}
                <div className="detail-actions">
                  <button type="button" className="primary-button" onClick={closeArPanel}>
                    Back to rack
                  </button>
                </div>
              </div>
            </section>
          ) : null
        }
      >
        <ARPreview
          product={arProduct}
          onClose={closeArPanel}
          followUpProducts={arFollowUpProducts}
          onTryAnotherProduct={(nextProduct) => {
            handleOpenAR(nextProduct, { reusePoster: true });
          }}
          onPreviewComplete={handlePreviewComplete}
          onCapturePoster={setActiveTryOnPoster}
          basePoster={activeTryOnPoster}
          initialResultImage={arProduct?.id ? previewCacheByProductId[arProduct.id] || "" : ""}
          previewCacheByProductId={previewCacheByProductId}
        />
      </AppErrorBoundary>
    </main>
  );
}
