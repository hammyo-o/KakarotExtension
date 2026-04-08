import { PaperbackInterceptor, Request } from "@paperback/types";
import { HitomiFile } from "./model";
import { addDataReceived } from "./settings";
import { ImageUriResolver } from "./utils/uri";

const hitomiInterceptorNoticeTimestamps = new Map<string, number>();

function logHitomiInterceptorNotice(
  key: string,
  message: string,
  minimumIntervalMs = 15000,
): void {
  const now = Date.now();
  const last = hitomiInterceptorNoticeTimestamps.get(key) ?? 0;
  if (now - last < minimumIntervalMs) {
    return;
  }
  hitomiInterceptorNoticeTimestamps.set(key, now);
  console.log(message);
}

export class HitomiInterceptor extends PaperbackInterceptor {
  private static readonly FALLBACK_IMAGE_URL =
    "https://ltn.gold-usergeneratedcontent.net/favicon-192x192.png";
  private syncGGCallback: (() => Promise<void>) | null = null;
  // Set to true when a CDN 404/403 signals that gg.js has rotated
  private ggRefreshNeeded = false;
  // Download pacing to avoid CDN 503/429 bursts during long chapter downloads.
  private imageThrottleChain: Promise<void> = Promise.resolve();
  private imageNextAllowedAt = 0;
  private rateLimitBackoffUntil = 0;
  private rateLimitStrikeCount = 0;
  private lastStrikeTime = 0;
  private readonly IMAGE_MIN_INTERVAL_MS = 180; // Reduced from 260 for better throughput
  private readonly IMAGE_JITTER_MAX_MS = 80; // Reduced from 120
  private readonly MAX_BACKOFF_MS = 5000; // Cap maximum backoff at 5 seconds
  private readonly STRIKE_DECAY_MS = 30000; // Decay strikes after 30 seconds of no issues

  setSyncGG(fn: () => Promise<void>): void {
    this.syncGGCallback = fn;
  }

  // Reset rate limiting state - call this on app restart/reinit
  resetRateLimitState(): void {
    this.rateLimitBackoffUntil = 0;
    this.rateLimitStrikeCount = 0;
    this.lastStrikeTime = 0;
    this.imageNextAllowedAt = 0;
    this.imageThrottleChain = Promise.resolve();
  }

  override async interceptRequest(request: Request): Promise<Request> {
    request.headers = {
      ...request.headers,
      Referer: "https://hitomi.la/",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    };

    // Rewrite lazy-placeholder URLs to real CDN URLs at download time.
    // This ensures fresh gg.js values are used for every image, preventing
    // failures when Hitomi rotates gg.js mid-chapter-download.
    if (request.url.startsWith("hitomi://image/")) {
      if (
        this.syncGGCallback &&
        (this.ggRefreshNeeded || ImageUriResolver.needsSync())
      ) {
        if (this.ggRefreshNeeded) {
          ImageUriResolver.invalidate();
        }
        try {
          await this.syncGGCallback();
          this.ggRefreshNeeded = false;
        } catch (e) {
          console.warn("[Hitomi] interceptRequest: syncGG failed", e);
        }
      }

      // Parse "hitomi://image/{hash}/{ext}"
      const rest = request.url.slice("hitomi://image/".length);
      const lastSlash = rest.lastIndexOf("/");

      // Validate we have valid components
      if (lastSlash <= 0 || lastSlash >= rest.length - 1) {
        console.warn(
          "[Hitomi] interceptRequest: malformed placeholder URL",
          request.url,
        );
        request.url = HitomiInterceptor.FALLBACK_IMAGE_URL;
        return request;
      }

      const hash = rest.slice(0, lastSlash);
      const ext = rest.slice(lastSlash + 1) as "webp" | "avif" | "jxl" | "gif";

      // Validate hash is not empty
      if (!hash || hash.length < 3) {
        console.warn(
          "[Hitomi] interceptRequest: invalid hash in placeholder",
          hash,
        );
        request.url = HitomiInterceptor.FALLBACK_IMAGE_URL;
        return request;
      }

      const file: HitomiFile = {
        index: 0,
        hash,
        name: `image.${ext}`,
        hasWebp: ext === "webp",
        hasAvif: ext === "avif",
        hasJxl: ext === "jxl",
        width: 0,
        height: 0,
      };

      try {
        const resolvedUrl = ImageUriResolver.getImageUri(file, ext, {
          isThumbnail: false,
        });
        // Ensure we got a valid HTTPS URL back
        if (resolvedUrl && resolvedUrl.startsWith("https://")) {
          request.url = resolvedUrl;
        } else {
          console.warn(
            "[Hitomi] interceptRequest: getImageUri returned invalid URL",
            resolvedUrl,
          );
          request.url = HitomiInterceptor.FALLBACK_IMAGE_URL;
        }
      } catch (e) {
        console.warn(
          "[Hitomi] interceptRequest: getImageUri failed for",
          hash,
          ext,
          e,
        );
        request.url = HitomiInterceptor.FALLBACK_IMAGE_URL;
      }
    }

    if (this.isCdnImageRequest(request.url)) {
      await this.refreshResolvedImageRequestUrl(request);
      await this.reserveImageRequestSlot();
    }

    return request;
  }

  override async interceptResponse(
    request: Request,
    response: unknown,
    data: any,
  ): Promise<any> {
    if (data && typeof data.byteLength === "number") {
      addDataReceived(data.byteLength);
    }

    // Detect CDN 404/403: indicates gg.js has been rotated server-side.
    // Flag so the next placeholder URL triggers a fresh gg.js sync before
    // computing the real CDN URL.
    if (
      response !== null &&
      typeof response === "object" &&
      "status" in response &&
      typeof (response as { status: unknown }).status === "number"
    ) {
      const status = (response as { status: number }).status;
      if (this.isCdnImageRequest(request.url)) {
        const now = Date.now();

        // Decay strikes over time - if no issues for STRIKE_DECAY_MS, reduce strike count
        if (
          this.lastStrikeTime > 0 &&
          now - this.lastStrikeTime > this.STRIKE_DECAY_MS
        ) {
          this.rateLimitStrikeCount = Math.max(
            0,
            this.rateLimitStrikeCount - 2,
          );
          if (this.rateLimitStrikeCount === 0) {
            this.rateLimitBackoffUntil = 0; // Clear backoff when strikes cleared
          }
        }

        if (status === 429 || status === 503) {
          this.rateLimitStrikeCount = Math.min(
            4,
            this.rateLimitStrikeCount + 1,
          ); // Max 4 strikes
          this.lastStrikeTime = now;
          const cooldownMs = Math.min(
            this.MAX_BACKOFF_MS,
            300 * 2 ** (this.rateLimitStrikeCount - 1), // Starts at 300ms, maxes at 5000ms
          );
          this.rateLimitBackoffUntil = now + cooldownMs;
          logHitomiInterceptorNotice(
            "hitomi-interceptor:cooldown",
            `[Hitomi] CDN ${status} detected — applying ${cooldownMs}ms cooldown (strike ${this.rateLimitStrikeCount})`,
            10000,
          );
        } else if (status >= 200 && status < 300) {
          // Successful request - decay strikes faster
          this.rateLimitStrikeCount = Math.max(
            0,
            this.rateLimitStrikeCount - 1,
          );
          if (this.rateLimitStrikeCount === 0) {
            this.rateLimitBackoffUntil = 0;
          }
        }
      }

      if (
        (status === 404 || status === 403) &&
        request.url.includes("gold-usergeneratedcontent.net") &&
        !request.url.includes("gg.js")
      ) {
        logHitomiInterceptorNotice(
          "hitomi-interceptor:gg-refresh",
          "[Hitomi] CDN 404/403 detected — gg.js refresh scheduled for next image",
          10000,
        );
        this.ggRefreshNeeded = true;
      }
    }

    return data;
  }

  private isCdnImageRequest(url: string): boolean {
    return (
      url.includes("gold-usergeneratedcontent.net") &&
      !url.includes("gg.js") &&
      !url.includes(".nozomi")
    );
  }

  private async reserveImageRequestSlot(): Promise<void> {
    await this.enqueueImageSlot(async () => {
      const now = Date.now();
      const waitForBackoff = Math.max(0, this.rateLimitBackoffUntil - now);
      const waitForPacing = Math.max(0, this.imageNextAllowedAt - now);
      const waitMs = Math.max(waitForBackoff, waitForPacing);
      if (waitMs > 0) {
        await this.sleep(waitMs);
      }
      const jitter = Math.floor(Math.random() * this.IMAGE_JITTER_MAX_MS);
      this.imageNextAllowedAt =
        Date.now() + this.IMAGE_MIN_INTERVAL_MS + jitter;
    });
  }

  private async enqueueImageSlot(fn: () => Promise<void>): Promise<void> {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previous = this.imageThrottleChain;
    this.imageThrottleChain = previous.then(() => gate);
    await previous;
    try {
      await fn();
    } finally {
      release();
    }
  }

  private sleep(ms: number): Promise<void> {
    if (ms <= 0) {
      return Promise.resolve();
    }
    return Application.sleep(ms / 1000);
  }

  private async refreshResolvedImageRequestUrl(
    request: Request,
  ): Promise<void> {
    if (
      !(this.ggRefreshNeeded || ImageUriResolver.needsSync()) ||
      !this.syncGGCallback
    ) {
      return;
    }

    const parsed = this.parseImageRequestUrl(request.url);
    if (!parsed) {
      return;
    }

    if (this.ggRefreshNeeded) {
      ImageUriResolver.invalidate();
    }

    try {
      await this.syncGGCallback();
      const refreshedUrl = ImageUriResolver.getImageUri(
        parsed.file,
        parsed.extension,
        {
          isThumbnail: parsed.isThumbnail,
          isSmall: parsed.isSmall,
        },
      );
      if (refreshedUrl.startsWith("https://")) {
        request.url = refreshedUrl;
        this.ggRefreshNeeded = false;
      }
    } catch (e) {
      console.warn(
        "[Hitomi] interceptRequest: failed to refresh stale image URL",
        e,
      );
    }
  }

  private parseImageRequestUrl(url: string): {
    extension: "webp" | "avif" | "jxl" | "gif";
    file: HitomiFile;
    isThumbnail: boolean;
    isSmall: boolean;
  } | null {
    const match = url.match(
      /^(?:https?:\/\/)?[^/]+\/(.+?)\.(webp|avif|jxl|gif)(?:\?.*)?$/i,
    );
    if (!match) {
      return null;
    }

    const path = match[1];
    const extension = match[2].toLowerCase() as "webp" | "avif" | "jxl" | "gif";
    const segments = path.split("/");
    const hash = segments[segments.length - 1];
    if (!hash || hash.length < 3) {
      return null;
    }

    const isSmall = path.includes("smalltn/");
    const isThumbnail = isSmall || path.includes("bigtn/");
    return {
      extension,
      isThumbnail,
      isSmall,
      file: {
        index: 0,
        hash,
        name: `image.${extension}`,
        hasWebp: extension === "webp",
        hasAvif: extension === "avif",
        hasJxl: extension === "jxl",
        width: 0,
        height: 0,
      },
    };
  }
}
