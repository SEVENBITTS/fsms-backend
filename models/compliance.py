from dataclasses import dataclass
from typing import Optional
from models.airspace import AirspaceZone


@dataclass
class ComplianceResult:
    lat: float
    lon: float
    alt_amsl_m: float
    alt_agl_m: Optional[float]
    breach: Optional[bool]
    breach_unknown: bool
    eval_status: str
    zone: Optional[AirspaceZone]
    t: float