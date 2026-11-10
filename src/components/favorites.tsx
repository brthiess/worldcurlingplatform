"use client";
import { useEffect, useState } from "react";
import {
  FAVORITES_KEY,
  readFavorites,
  writeFavorites,
  type Favorite,
} from "@/domain/discovery";
export function useFavorites() {
  const [favorites, setFavorites] = useState<Favorite[]>([]),
    [warning, setWarning] = useState("");
  useEffect(() => {
    const read = () => {
      try {
        setFavorites(readFavorites(localStorage.getItem(FAVORITES_KEY)));
      } catch {
        setWarning(
          "Browser storage is unavailable. Favorites cannot be saved on this device.",
        );
      }
    };
    read();
    window.addEventListener("storage", read);
    window.addEventListener("wcp:favorites", read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener("wcp:favorites", read);
    };
  }, []);
  function toggle(item: Favorite) {
    try {
      const current = readFavorites(localStorage.getItem(FAVORITES_KEY));
      const next = current.some((x) => x.kind === item.kind && x.id === item.id)
        ? current.filter((x) => !(x.kind === item.kind && x.id === item.id))
        : [...current, item];
      if (next.length > 500) {
        setWarning(
          "This browser already has 500 favorites. Remove one before saving another.",
        );
        return;
      }
      localStorage.setItem(FAVORITES_KEY, writeFavorites(next));
      setFavorites(next);
      setWarning("");
      window.dispatchEvent(new Event("wcp:favorites"));
    } catch {
      setWarning(
        "Browser storage is unavailable. Favorites cannot be saved on this device.",
      );
    }
  }
  return { favorites, toggle, warning };
}
export function FavoriteButton({
  kind,
  id,
}: {
  kind: Favorite["kind"];
  id: string;
}) {
  const { favorites, toggle, warning } = useFavorites();
  const saved = favorites.some((x) => x.kind === kind && x.id === id);
  return (
    <div className="favorite-control">
      <button
        className="secondary"
        aria-pressed={saved}
        onClick={() => toggle({ kind, id })}
      >
        {saved ? "Remove" : "Save"} {kind} favorite
      </button>
      {warning && (
        <p className="notice" role="status">
          {warning}
        </p>
      )}
    </div>
  );
}
