from dataclasses import dataclass


@dataclass
class FlightPoint:
    lat: float
    lon: float
    alt_amsl_m: float
    t_ms: float | None = None