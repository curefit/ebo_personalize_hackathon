import { Suspense, lazy, startTransition, useEffect, useMemo, useRef, useState } from "react";
import AppErrorBoundary from "./components/AppErrorBoundary";
import ARPreview from "./components/ARPreview";
import MemberLogin from "./components/MemberLogin";
import NonMemberQuestions from "./components/NonMemberQuestions";
import ProductDetails from "./components/ProductDetails";
import ProductGrid from "./components/ProductGrid";
import ToyMascotStudio from "./components/ToyMascotStudio";
import { fetchProducts, loginMember } from "./services/apiClient";
import { getRecommendations } from "./services/recommendationEngine";
import { APP_COPY, MEMBER_OPTIONS } from "./utils/constants";
import { buildGuestName, getInitials, normalizePhoneNumber } from "./utils/helpers";

const WelcomeAnimation = lazy(() => import("./components/WelcomeAnimation"));

export default function App() {
  const showToyStudio = new URLSearchParams(window.location.search).get("view") === "toy";
  const [screen, setScreen] = useState("member-check");
  const [catalog, setCatalog] = useState([]);
  const [catalogError, setCatalogError] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [shopperProfile, setShopperProfile] = useState(null);
  const [pendingMember, setPendingMember] = useState(null);
  const [memberLookupLoading, setMemberLookupLoading] = useState(false);
  const [memberVerifyLoading, setMemberVerifyLoading] = useState(false);
  const [memberError, setMemberError] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [arProduct, setArProduct] = useState(null);
  const memberLookupRequestRef = useRef(null);
  const memberLookupRequestIdRef = useRef(0);
  const browseSectionRef = useRef(null);
  const restoreBrowseScrollRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function loadCatalog() {
      try {
        const payload = await fetchProducts();
        if (!isMounted) {
          return;
        }

        setCatalog(payload.products || []);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setCatalogError(error.message);
      } finally {
        if (isMounted) {
          setCatalogLoading(false);
        }
      }
    }

    loadCatalog();

    return () => {
      isMounted = false;
    };
  }, []);

  const recommendations = useMemo(
    () => getRecommendations(catalog, shopperProfile, Math.min(catalog.length, 24)),
    [catalog, shopperProfile],
  );

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
        const member = { ...payload.member, userType: "member" };
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
    setScreen("welcome");
  }

  function handleGuestComplete(answers) {
    const shopper = {
      ...answers,
      name: buildGuestName(answers.activity),
      fitness_level: "Self-selected",
      userType: "guest",
    };

    setShopperProfile(shopper);
    setScreen("welcome");
  }

  function handleOpenDetails(product) {
    setSelectedProduct(product);
  }

  function handleOpenAR(product) {
    setSelectedProduct(null);
    setScreen("browse");
    setArProduct(product);
  }

  function handleCloseAR() {
    setArProduct(null);
    if (shopperProfile) {
      setSelectedProduct(null);
      setScreen("browse");
      restoreBrowseScrollRef.current = true;
    }
  }

  function renderOnboarding() {
    if (screen === "member-login") {
      return (
        <MemberLogin
          onBack={() => {
            memberLookupRequestIdRef.current += 1;
            memberLookupRequestRef.current = null;
            setPendingMember(null);
            setMemberError("");
            setMemberLookupLoading(false);
            setMemberVerifyLoading(false);
            setScreen("member-check");
          }}
          onRequestOtp={handleMemberOtpRequest}
          onVerifyOtp={handleMemberOtpVerify}
          requestLoading={memberLookupLoading}
          verifyLoading={memberVerifyLoading}
          error={memberError}
        />
      );
    }

    if (screen === "non-member") {
      return <NonMemberQuestions onBack={() => setScreen("member-check")} onComplete={handleGuestComplete} />;
    }

    return (
      <section className="panel landing-panel">
        <div className="landing-copy">
          <h1>{APP_COPY.heroTitle}</h1>
          <p>{APP_COPY.heroSubtitle}</p>
        </div>

        <div className="landing-actions">
          <h2>How would you like to start?</h2>
          <div className="member-choice-grid">
            {MEMBER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className="member-choice-card"
                onClick={() => setScreen(option.value === "member" ? "member-login" : "non-member")}
              >
                <span>{option.label}</span>
                <small>{option.value === "member" ? "Use your phone number" : "Answer 3 quick questions"}</small>
              </button>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (showToyStudio) {
    return <ToyMascotStudio />;
  }

  const hideTopbar = screen === "member-check" || screen === "member-login" || screen === "non-member";
  const showBrowse =
    Boolean(shopperProfile) &&
    screen !== "member-check" &&
    screen !== "member-login" &&
    screen !== "non-member" &&
    screen !== "welcome";
  const overlayOpen = Boolean(selectedProduct || arProduct);

  useEffect(() => {
    if (!overlayOpen) {
      return undefined;
    }

    const body = document.body;
    const html = document.documentElement;
    const previous = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
    };

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    return () => {
      html.style.overflow = previous.htmlOverflow;
      body.style.overflow = previous.bodyOverflow;
    };
  }, [overlayOpen]);

  useEffect(() => {
    if (!restoreBrowseScrollRef.current || arProduct || screen !== "browse") {
      return;
    }

    restoreBrowseScrollRef.current = false;
    window.requestAnimationFrame(() => {
      browseSectionRef.current?.scrollIntoView({ block: "start" });
    });
  }, [arProduct, screen]);

  return (
    <main className="app-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      {!hideTopbar ? (
        <header className="topbar">
          <div className="brand-lockup">
            <div className="brand-mark">{getInitials(shopperProfile?.name || "EBO")}</div>
            <div className="brand-copy">
              <strong>{shopperProfile?.name || "EBO Smart Kiosk"}</strong>
            </div>
          </div>
        </header>
      ) : null}

      {catalogLoading && !catalog.length ? (
        <section className="panel loading-panel">
          <h2>Loading catalog...</h2>
          <p>Preparing personalized picks.</p>
        </section>
      ) : null}

      {!catalogLoading && !catalog.length ? (
        <section className="panel loading-panel">
          <h2>Catalog unavailable</h2>
          <p>{catalogError || "No products were returned from the API."}</p>
        </section>
      ) : null}

      {!catalogLoading && catalog.length ? (
        <>
          {(screen === "member-check" || screen === "member-login" || screen === "non-member") && renderOnboarding()}

          {screen === "welcome" && shopperProfile ? (
            <Suspense
              fallback={
                <section className="panel loading-panel">
                  <h2>Loading welcome...</h2>
                  <p>Preparing your recommendations.</p>
                </section>
              }
            >
              <WelcomeAnimation
                shopperName={shopperProfile.name}
                shopperActivity={shopperProfile.activity}
                onComplete={() => startTransition(() => setScreen("browse"))}
              />
            </Suspense>
          ) : null}

          {showBrowse ? (
            <div ref={browseSectionRef}>
              <ProductGrid
                recommendations={recommendations}
                shopperProfile={shopperProfile}
                onOpenDetails={handleOpenDetails}
                onOpenAR={handleOpenAR}
              />
            </div>
          ) : null}
        </>
      ) : null}

      <ProductDetails
        product={selectedProduct}
        onBack={() => setSelectedProduct(null)}
        onOpenAR={handleOpenAR}
      />

      <AppErrorBoundary
        resetKey={arProduct?.id || "no-ar-product"}
        fallback={
          arProduct ? (
            <section className="overlay-shell ar-shell">
              <div className="overlay-card ar-panel">
                <div className="ar-copy">
                  <span className="eyebrow">Try-On Preview</span>
                  <h2>Preview unavailable</h2>
                  <p>The preview closed unexpectedly. You can return to the catalog and try again.</p>
                </div>
                <div className="tryon-actions">
                  <button type="button" className="primary-button" onClick={handleCloseAR}>
                    Back to catalog
                  </button>
                </div>
              </div>
            </section>
          ) : null
        }
      >
        <ARPreview product={arProduct} onClose={handleCloseAR} />
      </AppErrorBoundary>
    </main>
  );
}
