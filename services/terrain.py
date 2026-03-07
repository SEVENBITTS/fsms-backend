"""
Terrain adapter

This module abstracts terrain elevation lookup.

Right now it is a stub implementation.
Later it can connect to real terrain datasets
(SRTM, DEM tiles, PostGIS raster, etc).
"""


def get_elevation_m(lat: float, lon: float) -> float | None:
    """
    Return terrain elevation in meters above mean sea level.

    Currently returns None because terrain is not implemented yet.
    """

    return None


def compute_agl(alt_amsl_m: float, lat: float, lon: float) -> float | None:
    """
    Compute altitude above ground level.

    AGL = AMSL − terrain elevation
    """

    terrain = get_elevation_m(lat, lon)

    if terrain is None:
        return None

    return alt_amsl_m - terrain