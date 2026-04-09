import { useState } from "react";
import { normalizePhoneNumber } from "../utils/helpers";

const STATIC_OTP = "0000";

export default function MemberLogin({ onBack, onRequestOtp, onVerifyOtp, requestLoading, verifyLoading, error }) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("phone");
  const [localError, setLocalError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    if (step === "phone") {
      if (phone.length !== 10) {
        setLocalError("Enter a valid 10-digit phone number.");
        return;
      }

      setLocalError("");
      onRequestOtp(normalizePhoneNumber(phone));
      setStep("otp");
      return;
    }

    if (otp !== STATIC_OTP) {
      setLocalError("Use 0000 for this demo login.");
      return;
    }

    setLocalError("");
    onVerifyOtp();
  }

  function handleBack() {
    if (step === "otp") {
      setOtp("");
      setLocalError("");
      setStep("phone");
      return;
    }

    onBack();
  }

  return (
    <section className="brief-shell member-shell">
      <div className="brief-header">
        <span className="eyebrow">Member lookup</span>
      </div>

      <div className="brief-copy">
        <h2>{step === "phone" ? "Find the member profile." : "Verify the code."}</h2>
        <p>
          {step === "phone" ? "Use a phone number to load the saved profile." : "Demo OTP: `0000`."}
        </p>
      </div>

      <form className="member-form" onSubmit={handleSubmit}>
        {step === "phone" ? (
          <label className="field">
            <span>Phone number</span>
            <input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]{10}"
              maxLength={10}
              placeholder="10-digit mobile number"
              value={phone}
              onChange={(event) => {
                setPhone(normalizePhoneNumber(event.target.value));
                setLocalError("");
              }}
            />
          </label>
        ) : (
          <>
            <div className="otp-banner">
              <strong>OTP sent to {phone}</strong>
              <span>Use `0000`.</span>
            </div>

            <label className="field">
              <span>4-digit OTP</span>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                placeholder="Enter OTP"
                value={otp}
                onChange={(event) => {
                  setOtp(normalizePhoneNumber(event.target.value).slice(0, 4));
                  setLocalError("");
                }}
              />
            </label>
          </>
        )}

        {localError ? <p className="form-error">{localError}</p> : null}
        {!localError && error ? <p className="form-error">{error}</p> : null}

        <div className="brief-actions">
          <button type="button" className="ghost-button" onClick={handleBack}>
            Back
          </button>
          <button
            type="submit"
            className="primary-button"
            disabled={
              (step === "phone" ? requestLoading : verifyLoading) ||
              (step === "phone" ? phone.length !== 10 : otp.length !== 4)
            }
          >
            {step === "phone" ? (requestLoading ? "Looking up..." : "Send code") : verifyLoading ? "Loading..." : "Verify"}
          </button>
        </div>
      </form>
    </section>
  );
}
