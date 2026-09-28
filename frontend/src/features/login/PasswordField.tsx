import { useState, type InputHTMLAttributes } from "react";

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
} & Pick<
  InputHTMLAttributes<HTMLInputElement>,
  "autoComplete" | "disabled" | "minLength" | "required"
>;

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  disabled,
  minLength,
  required,
}: Props) {
  const [visible, setVisible] = useState(false);
  const revealLabel = visible ? "Ocultar contraseña" : "Mostrar contraseña";

  return (
    <>
      <label htmlFor={id}>{label}</label>
      <div className="password-field">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          minLength={minLength}
          disabled={disabled}
        />
        <button
          type="button"
          className="password-reveal"
          aria-label={revealLabel}
          aria-pressed={visible}
          title={revealLabel}
          disabled={disabled}
          onClick={() => setVisible((open) => !open)}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        d="M2.5 12s3.6-6.5 9.5-6.5S21.5 12 21.5 12 17.9 18.5 12 18.5 2.5 12 2.5 12Z"
      />
      <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        d="M3 4.5 20.5 20M9.2 9.4A3 3 0 0 0 12 15a3 3 0 0 0 2.7-1.7"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        d="M6.2 7.3C4 8.8 2.5 12 2.5 12s3.6 6.5 9.5 6.5c1.6 0 3-.3 4.2-.9M17.6 15.8c2-1.4 3.9-3.8 3.9-3.8s-3.6-6.5-9.5-6.5c-.7 0-1.4.1-2 .2"
      />
    </svg>
  );
}
