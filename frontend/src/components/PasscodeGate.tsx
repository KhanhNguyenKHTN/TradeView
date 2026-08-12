type PasscodeGateProps = {
  passcode: string;
  passcodeError: string;
  rememberLogin: boolean;
  onPasscodeChange: (value: string) => void;
  onRememberLoginChange: (checked: boolean) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

function PasscodeGate({
  passcode,
  passcodeError,
  rememberLogin,
  onPasscodeChange,
  onRememberLoginChange,
  onSubmit,
}: PasscodeGateProps) {
  return (
    <div className="passcode-shell">
      <section className="passcode-card">
        <span className="eyebrow">Khánh Thảo Family</span>
        <h1>Mã truy cập</h1>
        <p className="hero-text passcode-text">
          Nhập passcode 6 chữ số để truy cập trang quản lý tài chính gia đình.
        </p>

        <form className="passcode-form" onSubmit={onSubmit}>
          <label htmlFor="passcode-input" className="passcode-label">
            Passcode
          </label>
          <input
            id="passcode-input"
            className="passcode-input"
            type="password"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            autoComplete="one-time-code"
            placeholder="••••••"
            value={passcode}
            onChange={(event) => onPasscodeChange(event.target.value)}
            required
          />

          <label className="remember-option">
            <input
              type="checkbox"
              checked={rememberLogin}
              onChange={(event) => onRememberLoginChange(event.target.checked)}
            />
            <span>Ghi nhớ đăng nhập trên thiết bị này</span>
          </label>

          {passcodeError ? <strong className="loss">{passcodeError}</strong> : null}

          <button type="submit" className="primary-button passcode-button">
            Truy cập
          </button>
        </form>
      </section>
    </div>
  );
}

export default PasscodeGate;