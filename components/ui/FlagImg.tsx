"use client";

export default function FlagImg({ code, size = 28 }: { code: string; size?: number }) {
  return (
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      alt={code}
      width={size}
      height={Math.round(size * 0.67)}
      style={{
        display     : "inline-block",
        objectFit   : "cover",
        borderRadius: 2,
        boxShadow   : "0 1px 4px rgba(0,0,0,0.45)",
        verticalAlign: "middle",
      }}
    />
  );
}
