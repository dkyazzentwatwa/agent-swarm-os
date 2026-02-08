import { forwardRef } from "react";

export const SearchInput = forwardRef(function SearchInput(
  { value, onChange, placeholder = "Search...", className, inputId },
  ref
) {
  return (
    <div className={className}>
      <label className="sr-only" htmlFor={inputId}>{placeholder}</label>
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          ref={ref}
          id={inputId}
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full rounded-md border border-border bg-[var(--surface-2)] px-3 py-2 pl-9 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
        />
      </div>
    </div>
  );
});
