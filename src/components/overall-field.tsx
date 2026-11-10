"use client";
import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ReactNode,
  type ReactElement,
} from "react";
/** Keep label text separate from a select's options and a textarea's saved text. */
export function OverallField({ children }: { children: ReactNode }) {
  const id = useId(),
    items = Children.toArray(children),
    control = items.find(
      (c) =>
        isValidElement(c) &&
        ["input", "select", "textarea"].includes(String(c.type)),
    ) as ReactElement<{ id?: string }> | undefined;
  return (
    <div className="overall-field">
      <label htmlFor={id}>{items.filter((c) => c !== control)}</label>
      {control ? cloneElement(control, { id }) : null}
    </div>
  );
}
