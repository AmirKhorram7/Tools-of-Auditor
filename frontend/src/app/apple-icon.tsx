import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen / Safari touch icon — same brand mark, larger. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ff9900",
          borderRadius: 40,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 96,
              height: 22,
              background: "#0f1111",
              borderRadius: 4,
            }}
          />
          <div
            style={{
              width: 28,
              height: 78,
              background: "#0f1111",
              marginTop: 0,
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
