export type Seed = number | string;

const UINT32_MAX_PLUS_ONE = 0x1_0000_0000;

export class SeededRng {
  private state: number;

  constructor(seed: Seed) {
    const normalizedSeed = normalizeSeed(seed);
    this.state = normalizedSeed === 0 ? 0x6d2b79f5 : normalizedSeed;
  }

  nextUint32(): number {
    let value = (this.state += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (value ^ (value >>> 14)) >>> 0;
  }

  nextFloat(): number {
    return this.nextUint32() / UINT32_MAX_PLUS_ONE;
  }

  nextInt(minInclusive: number, maxExclusive: number): number {
    if (!Number.isInteger(minInclusive) || !Number.isInteger(maxExclusive)) {
      throw new Error("nextInt requires integer bounds.");
    }
    if (maxExclusive <= minInclusive) {
      throw new Error("nextInt requires maxExclusive > minInclusive.");
    }
    return (
      minInclusive +
      Math.floor(this.nextFloat() * (maxExclusive - minInclusive))
    );
  }

  nextBoolean(probability = 0.5): boolean {
    if (probability < 0 || probability > 1) {
      throw new Error("nextBoolean requires a probability between 0 and 1.");
    }
    return this.nextFloat() < probability;
  }

  pick<Value>(values: readonly Value[]): Value {
    if (values.length === 0) {
      throw new Error("pick requires at least one value.");
    }
    return values[this.nextInt(0, values.length)];
  }

  shuffle<Value>(values: readonly Value[]): Value[] {
    const copy = [...values];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = this.nextInt(0, index + 1);
      const current = copy[index];
      copy[index] = copy[swapIndex];
      copy[swapIndex] = current;
    }
    return copy;
  }

  fork(label: Seed): SeededRng {
    return new SeededRng(`${this.state}:${String(label)}`);
  }
}

export function normalizeSeed(seed: Seed): number {
  if (typeof seed === "number") {
    return seed >>> 0;
  }

  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function formatSeedToken(seed: Seed): string {
  return normalizeSeed(seed).toString(16).padStart(8, "0");
}
