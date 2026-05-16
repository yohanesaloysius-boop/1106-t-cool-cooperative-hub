import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type CartItem = {
  product_id: string;
  store_id: string;
  store_slug?: string;
  store_nama: string;
  store_whatsapp?: string | null;
  nama_produk: string;
  harga: number;
  diskon_persen?: number;
  gambar?: string | null;
  qty: number;
  stok: number;
};

type CartCtx = {
  items: CartItem[];
  count: number;
  total: number;
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  remove: (product_id: string) => void;
  setQty: (product_id: string, qty: number) => void;
  clear: () => void;
  clearStore: (store_id: string) => void;
};

const KEY = "tcool.cart.v1";
const Ctx = createContext<CartCtx | undefined>(undefined);

function effectivePrice(i: { harga: number; diskon_persen?: number }) {
  const d = i.diskon_persen ?? 0;
  return d > 0 ? Math.round(i.harga * (1 - d / 100)) : i.harga;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(items));
    } catch {}
  }, [items]);

  const add: CartCtx["add"] = (item, qty = 1) => {
    setItems((prev) => {
      const ix = prev.findIndex((p) => p.product_id === item.product_id);
      if (ix >= 0) {
        const next = [...prev];
        next[ix] = { ...next[ix], qty: Math.min(next[ix].qty + qty, item.stok || 999) };
        return next;
      }
      return [...prev, { ...item, qty: Math.min(qty, item.stok || 999) }];
    });
  };

  const remove: CartCtx["remove"] = (id) => setItems((p) => p.filter((x) => x.product_id !== id));
  const setQty: CartCtx["setQty"] = (id, qty) =>
    setItems((p) =>
      p.map((x) => (x.product_id === id ? { ...x, qty: Math.max(1, Math.min(qty, x.stok || 999)) } : x)),
    );
  const clear = () => setItems([]);
  const clearStore = (store_id: string) => setItems((p) => p.filter((x) => x.store_id !== store_id));

  const count = items.reduce((s, x) => s + x.qty, 0);
  const total = items.reduce((s, x) => s + effectivePrice(x) * x.qty, 0);

  return (
    <Ctx.Provider value={{ items, count, total, add, remove, setQty, clear, clearStore }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used inside CartProvider");
  return c;
}

export function cartItemEffectivePrice(i: { harga: number; diskon_persen?: number }) {
  return effectivePrice(i);
}
