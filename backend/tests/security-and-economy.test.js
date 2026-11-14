import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { FEATURE_COIN_COSTS } from "../services/auth/constants/coinPricing.js";
import { verifyGatewayOrigin } from "../services/resume/middleware/gatewayAuth.js";
import { validatePdfBuffer } from "../services/resume/utils/pdfValidator.js";
import { validateResourceUrl, TRUSTED_RESOURCE_DOMAINS } from "../services/roadmap/utils/urlValidator.js";

describe("1. Server-Side Feature Pricing Allowlist", () => {
    test("FEATURE_COIN_COSTS contains allowlisted pricing for key features", () => {
        assert.equal(FEATURE_COIN_COSTS.INTERVIEW_START, 50);
        assert.equal(FEATURE_COIN_COSTS["start-interview"], 50);

        assert.equal(FEATURE_COIN_COSTS.RESUME_SCORE, 10);
        assert.equal(FEATURE_COIN_COSTS["resume-scorer"], 10);

        assert.equal(FEATURE_COIN_COSTS.ROADMAP_GENERATE, 20);
        assert.equal(FEATURE_COIN_COSTS["roadmap-builder"], 20);

        assert.equal(FEATURE_COIN_COSTS.RESUME_PDF_DOWNLOAD, 10);
        assert.equal(FEATURE_COIN_COSTS["download-pdf"], 10);
    });

    test("Rejects or flags undefined action names", () => {
        assert.equal(FEATURE_COIN_COSTS["HACK_UNLIMITED_COINS"], undefined);
        assert.equal(FEATURE_COIN_COSTS["admin-credit"], undefined);
    });
});

describe("2. Gateway-Origin Verification Middleware", () => {
    const configuredSecret = "test-gateway-secret-2026";
    process.env.GATEWAY_INTERNAL_SECRET = configuredSecret;

    test("Rejects request with missing x-gateway-secret header (403)", () => {
        let statusCode = null;
        let jsonResponse = null;

        const req = { headers: {} };
        const res = {
            status: (code) => {
                statusCode = code;
                return {
                    json: (data) => {
                        jsonResponse = data;
                    },
                };
            },
        };
        let nextCalled = false;
        const next = () => { nextCalled = true; };

        verifyGatewayOrigin(req, res, next);

        assert.equal(statusCode, 403);
        assert.equal(jsonResponse?.success, false);
        assert.equal(nextCalled, false);
    });

    test("Rejects request with invalid x-gateway-secret header (403)", () => {
        let statusCode = null;
        let jsonResponse = null;

        const req = { headers: { "x-gateway-secret": "wrong-secret-value" } };
        const res = {
            status: (code) => {
                statusCode = code;
                return {
                    json: (data) => {
                        jsonResponse = data;
                    },
                };
            },
        };
        let nextCalled = false;
        const next = () => { nextCalled = true; };

        verifyGatewayOrigin(req, res, next);

        assert.equal(statusCode, 403);
        assert.equal(jsonResponse?.success, false);
        assert.equal(nextCalled, false);
    });

    test("Passes request with valid x-gateway-secret header", () => {
        const req = { headers: { "x-gateway-secret": configuredSecret } };
        const res = {};
        let nextCalled = false;
        const next = () => { nextCalled = true; };

        verifyGatewayOrigin(req, res, next);

        assert.equal(nextCalled, true);
    });
});

describe("3. PDF Magic-Byte Signature Validation", () => {
    test("Accepts valid %PDF- magic bytes header", () => {
        const validBuffer = Buffer.from("%PDF-1.7\n%some content...");
        assert.equal(validatePdfBuffer(validBuffer), true);
    });

    test("Rejects spoofed plain text files", () => {
        const textBuffer = Buffer.from("Hello world, this is a plain text file");
        assert.equal(validatePdfBuffer(textBuffer), false);
    });

    test("Rejects executable or binary files", () => {
        const exeBuffer = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03]); // MZ header
        assert.equal(validatePdfBuffer(exeBuffer), false);
    });

    test("Rejects empty or short buffers", () => {
        assert.equal(validatePdfBuffer(Buffer.alloc(0)), false);
        assert.equal(validatePdfBuffer(Buffer.from("%PD")), false);
        assert.equal(validatePdfBuffer(null), false);
    });
});

describe("4. Roadmap Resource HTTPS & Domain Allowlist Validation", () => {
    test("Accepts trusted documentation URLs with https", () => {
        const validDocs = [
            "https://react.dev/reference/react",
            "https://nodejs.org/en/docs",
            "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
            "https://docs.python.org/3/tutorial/",
            "https://kubernetes.io/docs/home/",
            "https://youtube.com/watch?v=12345",
            "https://youtu.be/abcdef",
        ];

        for (const url of validDocs) {
            const validated = validateResourceUrl(url);
            assert.ok(validated, `Expected ${url} to be accepted`);
            assert.ok(validated.startsWith("https://"));
        }
    });

    test("Rejects unencrypted http:// links and falls back", () => {
        const insecureUrl = "http://react.dev/reference/react";
        const fallback = "https://www.google.com/search?q=fallback";
        const result = validateResourceUrl(insecureUrl, fallback);
        assert.equal(result, fallback);
    });

    test("Rejects untrusted or spoofed domains", () => {
        const maliciousUrl = "https://malicious-phishing-site.com/exploit";
        const fallback = "https://www.google.com/search?q=fallback";
        const result = validateResourceUrl(maliciousUrl, fallback);
        assert.equal(result, fallback);
    });

    test("Handles malformed URLs gracefully", () => {
        const fallback = "https://www.google.com/search?q=fallback";
        assert.equal(validateResourceUrl("not-a-valid-url", fallback), fallback);
        assert.equal(validateResourceUrl("", fallback), fallback);
        assert.equal(validateResourceUrl(null, fallback), fallback);
    });
});
