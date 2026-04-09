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
      setLocalError("Enter the correct 4-digit OTP.");
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
    <section className="panel auth-panel">
      <div className="panel-copy">
        <span className="eyebrow">Member Login</span>
        <h2>{step === "phone" ? "Enter your phone number." : "Enter the OTP to continue."}</h2>
        <p>
          {step === "phone"
            ? "Exclusive discounts for Cult members. Login to grab them."
            : "Use the static OTP below for the demo and continue to your picks."}
        </p>
      </div>

      <div className="member-login-note">
        <strong>"Members get the best edit first."</strong>
        <span>Login to unlock exclusive pricing and sharper recommendations.</span>
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
            <div className="otp-header">
              <span>OTP sent to {phone}</span>
              <small>Use `0000` for this demo.</small>
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

        <div className="form-actions">
          <button type="button" className="ghost-button" onClick={handleBack}>
            Back
          </button>
          <button
            type="submit"
            className="primary-button"
            disabled={(step === "phone" ? requestLoading : verifyLoading) || (step === "phone" ? phone.length !== 10 : otp.length !== 4)}
          >
            {step === "phone"
              ? "Send OTP"
              : verifyLoading
                ? "Loading profile..."
                : requestLoading
                  ? "Verify OTP"
                  : "Verify OTP"}
          </button>
        </div>
      </form>
    </section>
  );
}
