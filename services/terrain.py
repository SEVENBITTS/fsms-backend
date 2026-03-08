"""
Terrain adapter

This module abstracts terrain elevation lookup.

Right now it is a stub implementation.
Later it can connect to real terrain datasets
(SRTM, DEM tiles, PostGIS raster, etc).
"""


class TerrainAdapter:
    """
    Stub terrain adapter.

    Returns None until real terrain lookup is implemented.
    """

    def get_elevation_m_amsl(self, lat: float, lon: float) -> float | None:
        return None


def compute_agl(alt_amsl_m: float, lat: float, lon: float) -> float | None:
    terrain = TerrainAdapter().get_elevation_m_amsl(lat, lon)

    if terrain is None:
        return None

    return alt_amsl_m - terrain