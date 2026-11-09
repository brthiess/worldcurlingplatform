"use client";
import { useEffect, useState } from "react";
import { contextLink } from "@/domain/discovery";
export function usePublicContext() {
  const [query, setQuery] = useState("");
  useEffect(() => {
    const read = () => {
      const params = new URLSearchParams(window.location.search);
      const eventId = /^\/events\/([^/]+)/.exec(window.location.pathname)?.[1];
      if (eventId) params.set("event", eventId);
      setQuery(params.toString());
    };
    read();
    window.addEventListener("popstate", read);
    window.addEventListener("wcp:context", read);
    return () => {
      window.removeEventListener("popstate", read);
      window.removeEventListener("wcp:context", read);
    };
  }, []);
  return query;
}
export function PublicLink({
  href,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const source = usePublicContext();
  return (
    <a {...props} href={contextLink(href, source)}>
      {children}
    </a>
  );
}
export function usePublicFilters() {
  const query = usePublicContext();
  const filters = Object.fromEntries(new URLSearchParams(query));
  function change(values: Record<string, string>) {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(values)) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    window.history.replaceState({}, "", url);
    window.dispatchEvent(new Event("wcp:context"));
  }
  return { filters, change, query };
}
