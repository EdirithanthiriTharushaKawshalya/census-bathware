export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const paths: Record<string, string> = {
    home: "m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z",
    catalogue: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
    cart: "M3 3h2l2.5 12h10L21 7H6M9 20h.01M17 20h.01",
    orders: "M8 3H5v18h14V3h-3M8 2h8v4H8zM8 11h8M8 15h5",
    invoices: "M6 3h12v19l-3-2-3 2-3-2-3 2ZM9 7h6M9 11h6M9 15h3",
    deliveries:
      "M3 5h11v12H3zM14 9h4l3 4v4h-7M5 17v2a2 2 0 0 0 4 0v-2M16 17v2a2 2 0 0 0 4 0v-2",
    enquiries: "M21 11a8 8 0 0 1-8 8H8l-5 3V11a9 9 0 0 1 18 0ZM8 10h8M8 14h5",
    collections: "M3 6h18v14H3zM3 6l14-4v4M16 11h5v5h-5z",
    reporting: "M4 20h17M7 16v-5M12 16V5M17 16V8",
    more: "M5 12h.01M12 12h.01M19 12h.01",
    arrow: "M5 12h14m-5-5 5 5-5 5",
    close: "m6 6 12 12M6 18 18 6",
    shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Zm-4 9 3 3 5-6",
    eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0",
    logout: "M9 4H4v16h5M10 12h11m-4-4 4 4-4 4",
    chevron: "m9 5 7 7-7 7",
    bag: "M5 7h14l1 14H4ZM9 7V5a3 3 0 0 1 6 0v2",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.catalogue} />
    </svg>
  );
}
