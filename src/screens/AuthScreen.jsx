import { useState } from "react";
import * as api from "../api";
import BrandMark from "../components/icons/BrandMark";
import { BackIcon } from "../components/icons/UiIcons";
import "./AuthScreen.css";

export default function AuthScreen({ onLogin }) {
  const [step, setStep] = useState("email"); // email | code
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function sendCode() {
    const e = email.trim().toLowerCase();
    if (!e.includes("@")) {
      setMsg("Enter a valid email address.");
      return;
    }
    setLoading(true);
    setMsg("");
    try {
      const r = await api.requestCode(e);
      setEmail(e);
      setStep("code");
      setCode("");
      // Dev fallback: if the server isn't wired to SMTP it echoes the code.
      setMsg(r.devCode ? `Dev mode — your code is ${r.devCode}` : `We emailed a 6-digit code to ${e}.`);
    } catch (err) {
      setMsg(err.message || "Couldn't send the code. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    const c = code.trim();
    if (!/^\d{6}$/.test(c)) {
      setMsg("Enter the 6-digit code from your email.");
      return;
    }
    setLoading(true);
    setMsg("");
    try {
      const { user, isNew, startingBalance } = await api.verifyCode(email, c);
      if (isNew) setMsg(`Welcome! Your account starts with $${startingBalance}.`);
      setTimeout(() => onLogin(user), isNew ? 500 : 200);
    } catch (err) {
      setMsg(err.message || "Couldn't verify the code. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="lf-app lf-app--centered">
      <div className="lf-panel lf-auth">
        <div className="lf-brand">
          <BrandMark className="lf-brand__mark" />
          <h1 className="lf-title">Lucky Felt</h1>
        </div>
        <p className="lf-subtitle">Casino &amp; gaming club</p>
        {step === "email" ? (
          <>
            <h2 className="lf-auth__prompt">Enter your email to play</h2>
            <label htmlFor="email-input" className="lf-visually-hidden">
              Email address
            </label>
            <input
              id="email-input"
              className="lf-input"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendCode()}
            />
            <button
              className="lf-btn lf-btn--gold lf-btn--block lf-auth__submit"
              onClick={sendCode}
              disabled={loading}
            >
              {loading ? "Sending…" : "Email me a code"}
            </button>
            <p className="lf-auth__hint">No password — we email you a one-time sign-in code.</p>
          </>
        ) : (
          <>
            <h2 className="lf-auth__prompt">Enter your 6-digit code</h2>
            <label htmlFor="code-input" className="lf-visually-hidden">
              Sign-in code
            </label>
            <input
              id="code-input"
              className="lf-input lf-auth__code-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && verify()}
            />
            <button
              className="lf-btn lf-btn--gold lf-btn--block lf-auth__submit"
              onClick={verify}
              disabled={loading}
            >
              {loading ? "Verifying…" : "Enter the Casino"}
            </button>
            <div className="lf-auth__actions">
              <button
                className="lf-btn lf-btn--ghost lf-btn--sm"
                onClick={() => {
                  setStep("email");
                  setMsg("");
                  setCode("");
                }}
                disabled={loading}
              >
                <BackIcon className="lf-btn__icon" />
                Change email
              </button>
              <button className="lf-btn lf-btn--ghost lf-btn--sm" onClick={sendCode} disabled={loading}>
                Resend code
              </button>
            </div>
          </>
        )}
        {msg && (
          <div role="status" className="lf-auth__msg">
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}
