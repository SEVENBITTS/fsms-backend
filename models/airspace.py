from dataclasses import dataclass
from typing import Any, Dict


@dataclass
class AirspaceZone:
    id: str
    name: str
    zone_type: str
    source: str | None
    external_id: str | None
    lower_m: float | None
    upper_m: float | None
    properties: Dict[str, Any]