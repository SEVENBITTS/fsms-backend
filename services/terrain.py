from __future__ import annotations

class TerrainAdapter:
    """
    v0.4 stub:
      - Return None => terrain unknown (AGL cannot be computed)
      - For deterministic AGL testing, return 0.0 (AGL == AMSL)
    """
    def get_elevation_m_amsl(self, lat: float, lon: float) -> float | None:
        return None
        # return 0.0