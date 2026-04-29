interface Props {
  channels: string[];
  size?: "sm" | "md";
  align?: "start" | "end";
}

export function ChannelChips({ channels, size = "md", align = "end" }: Props) {
  if (channels.length === 0) return null;

  const chipStyle = {
    background: "rgba(248, 244, 232, 0.08)",
    border: "1px solid rgba(248, 244, 232, 0.16)",
    borderRadius: 999,
    padding: size === "sm" ? "4px 8px" : "6px 10px",
    fontSize: size === "sm" ? "10px" : "12px",
    color: "var(--text-muted)",
    letterSpacing: "0.04em",
    fontFamily: "var(--font-sans)",
    lineHeight: 1,
  } as const;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: size === "sm" ? 6 : 8, justifyContent: align }}>
      {channels.map((name) => (
        <span key={name} style={chipStyle}>
          {name}
        </span>
      ))}
    </div>
  );
}
