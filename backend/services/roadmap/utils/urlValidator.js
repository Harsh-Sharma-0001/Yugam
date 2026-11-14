export const TRUSTED_RESOURCE_DOMAINS = [
    "developer.mozilla.org",
    "react.dev",
    "nodejs.org",
    "docs.python.org",
    "python.org",
    "typescriptlang.org",
    "kubernetes.io",
    "docs.docker.com",
    "docker.com",
    "mongodb.com",
    "redis.io",
    "postgresql.org",
    "aws.amazon.com",
    "cloud.google.com",
    "learn.microsoft.com",
    "github.com",
    "youtube.com",
    "youtu.be",
    "w3schools.com",
    "geeksforgeeks.org",
    "roadmap.sh",
    "freecodecamp.org",
    "dev.to",
    "medium.com",
    "stackoverflow.com",
    "kaggle.com",
    "pytorch.org",
    "tensorflow.org",
    "huggingface.co",
    "spring.io",
    "go.dev",
    "rust-lang.org",
    "playwright.dev",
    "expressjs.com",
    "graphql.org",
    "nextjs.org",
    "tailwindcss.com"
];

export const validateResourceUrl = (rawUrl, fallbackUrl = null) => {
    if (!rawUrl || typeof rawUrl !== "string") {
        return fallbackUrl;
    }

    try {
        const parsed = new URL(rawUrl.trim());
        if (parsed.protocol !== "https:") {
            return fallbackUrl;
        }

        const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
        const isTrusted = TRUSTED_RESOURCE_DOMAINS.some(
            (domain) => hostname === domain || hostname.endsWith("." + domain)
        );

        if (isTrusted) {
            return parsed.toString();
        }

        return fallbackUrl;
    } catch {
        return fallbackUrl;
    }
};
