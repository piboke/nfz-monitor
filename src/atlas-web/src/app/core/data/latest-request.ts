/** Invalidates earlier asynchronous responses when the scope changes or the owner is destroyed. */
export class LatestRequest {
  private version = 0;
  begin(): number {
    return ++this.version;
  }
  isCurrent(version: number): boolean {
    return this.version === version;
  }
  invalidate(): void {
    ++this.version;
  }
}
