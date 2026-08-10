import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * Raster favicon for browsers that prefer PNG over SVG.
 * Matches site brand: Amazon orange tile + dark "T" monogram (Tauditor).
 */
export default function Icon() {
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
          borderRadius: 8,
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
              width: 18,
              height: 4,
              background: "#0f1111",
              borderRadius: 1,
            }}
          />
          <div
            style={{
              width: 5,
              height: 14,
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
