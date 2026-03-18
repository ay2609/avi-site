interface IndexedPoint {
  id: number;
  lat: number;
  lng: number;
}

export class GeoSpatialHash {
  private readonly buckets = new Map<string, number[]>();
  private readonly points = new Map<number, IndexedPoint>();

  constructor(private readonly cellSizeDeg: number) {}

  clear(): void {
    this.buckets.clear();
    this.points.clear();
  }

  insert(id: number, lat: number, lng: number): void {
    const normalizedLng = normalizeLongitude(lng);
    const key = this.getKey(lat, normalizedLng);
    const bucket = this.buckets.get(key);

    if (bucket) {
      bucket.push(id);
    } else {
      this.buckets.set(key, [id]);
    }

    this.points.set(id, { id, lat, lng: normalizedLng });
  }

  query(lat: number, lng: number, radiusDeg: number): number[] {
    const normalizedLng = normalizeLongitude(lng);
    const latIndex = this.getLatIndex(lat);
    const lngIndex = this.getLngIndex(normalizedLng);
    const latRadius = Math.max(1, Math.ceil(radiusDeg / this.cellSizeDeg));
    const lonScale = Math.max(Math.cos((lat * Math.PI) / 180), 0.25);
    const lngRadius = Math.max(1, Math.ceil(radiusDeg / (this.cellSizeDeg * lonScale)));

    const ids = new Set<number>();

    for (let latOffset = -latRadius; latOffset <= latRadius; latOffset += 1) {
      const nextLatIndex = latIndex + latOffset;
      if (nextLatIndex < 0 || nextLatIndex >= this.getLatCellCount()) {
        continue;
      }

      for (let lngOffset = -lngRadius; lngOffset <= lngRadius; lngOffset += 1) {
        const nextLngIndex = modulo(lngIndex + lngOffset, this.getLngCellCount());
        const bucket = this.buckets.get(`${nextLatIndex}:${nextLngIndex}`);
        if (!bucket) {
          continue;
        }

        for (const id of bucket) {
          ids.add(id);
        }
      }
    }

    return [...ids];
  }

  getPoint(id: number): IndexedPoint | undefined {
    return this.points.get(id);
  }

  private getKey(lat: number, lng: number): string {
    return `${this.getLatIndex(lat)}:${this.getLngIndex(lng)}`;
  }

  private getLatIndex(lat: number): number {
    const shifted = (clamp(lat, -89.999, 89.999) + 90) / this.cellSizeDeg;
    return Math.min(this.getLatCellCount() - 1, Math.max(0, Math.floor(shifted)));
  }

  private getLngIndex(lng: number): number {
    const shifted = (normalizeLongitude(lng) + 180) / this.cellSizeDeg;
    return modulo(Math.floor(shifted), this.getLngCellCount());
  }

  private getLatCellCount(): number {
    return Math.ceil(180 / this.cellSizeDeg);
  }

  private getLngCellCount(): number {
    return Math.ceil(360 / this.cellSizeDeg);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function normalizeLongitude(lng: number): number {
  let normalized = ((lng + 180) % 360 + 360) % 360 - 180;
  if (normalized === -180) {
    normalized = 180;
  }
  return normalized;
}

