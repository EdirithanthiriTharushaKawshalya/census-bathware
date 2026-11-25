/** Cache expendable values, never authorization decisions or session credentials. */
export class BoundedCache<T> {
  private entries = new Map<string, { value: T; expiresAt: number }>();
  constructor(
    private readonly capacity: number,
    private readonly now = Date.now,
  ) {}
  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return;
    }
    return entry.value;
  }
  set(key: string, value: T, ttlMilliseconds: number) {
    this.entries.delete(key);
    for (const [name, entry] of this.entries)
      if (entry.expiresAt <= this.now()) this.entries.delete(name);
    while (this.entries.size >= this.capacity)
      this.entries.delete(this.entries.keys().next().value!);
    this.entries.set(key, { value, expiresAt: this.now() + ttlMilliseconds });
  }
}
