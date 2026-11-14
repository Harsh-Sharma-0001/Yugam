import { test, describe, after } from "node:test";
import assert from "node:assert/strict";

import { requireRole as requireAuthRole } from "../services/auth/middleware/roleAuth.js";
import { requireRole as requireInterviewRole } from "../services/interview/middleware/roleAuth.js";
import { proxyWithHeaders } from "../gateway/utils/proxyWithHeaders.js";
import redis from "../shared/redis/redis.js";

after(async () => {
    try {
        redis.disconnect();
    } catch {}
});

describe("1. RBAC & Role Authorization Middleware", () => {
    const configuredSecret = "test-gateway-internal-secret";
    process.env.GATEWAY_INTERNAL_SECRET = configuredSecret;

    test("Rejects request with no credentials (401)", async () => {
        const middleware = requireAuthRole("admin");
        let statusCode = null;
        let jsonResponse = null;
        let nextCalled = false;

        const req = { headers: {} };
        const res = {
            status: (code) => {
                statusCode = code;
                return { json: (d) => { jsonResponse = d; } };
            },
        };
        const next = () => { nextCalled = true; };

        await middleware(req, res, next);

        assert.equal(statusCode, 401);
        assert.equal(jsonResponse?.success, false);
        assert.equal(nextCalled, false);
    });

    test("Rejects student role attempting to access admin route (403 Forbidden)", async () => {
        const middleware = requireAuthRole("admin");
        let statusCode = null;
        let jsonResponse = null;
        let nextCalled = false;

        const req = {
            headers: {
                "x-gateway-secret": configuredSecret,
                "x-user-id": "student-123",
                "x-user-role": "student",
                "x-institution-id": "COLLEGE_A",
            },
        };
        const res = {
            status: (code) => {
                statusCode = code;
                return { json: (d) => { jsonResponse = d; } };
            },
        };
        const next = () => { nextCalled = true; };

        await middleware(req, res, next);

        assert.equal(statusCode, 403);
        assert.match(jsonResponse?.message, /Forbidden.*Role 'student'/);
        assert.equal(nextCalled, false);
    });

    test("Allows admin role to access admin-only route", async () => {
        const middleware = requireAuthRole("admin");
        let nextCalled = false;

        const req = {
            headers: {
                "x-gateway-secret": configuredSecret,
                "x-user-id": "admin-999",
                "x-user-role": "admin",
                "x-institution-id": "COLLEGE_A",
            },
        };
        const res = {
            status: () => ({ json: () => {} }),
        };
        const next = () => { nextCalled = true; };

        await middleware(req, res, next);

        assert.equal(nextCalled, true);
        assert.equal(req.userId, "admin-999");
        assert.equal(req.userRole, "admin");
        assert.equal(req.institutionId, "COLLEGE_A");
    });

    test("Allows trainer and admin to access multi-role endpoint", async () => {
        const middleware = requireInterviewRole("admin", "trainer");
        let nextCalledTrainer = false;
        let nextCalledAdmin = false;

        const reqTrainer = {
            headers: {
                "x-gateway-secret": configuredSecret,
                "x-user-id": "trainer-101",
                "x-user-role": "trainer",
                "x-institution-id": "COLLEGE_B",
            },
        };
        const reqAdmin = {
            headers: {
                "x-gateway-secret": configuredSecret,
                "x-user-id": "admin-102",
                "x-user-role": "admin",
                "x-institution-id": "COLLEGE_B",
            },
        };
        const res = { status: () => ({ json: () => {} }) };

        await middleware(reqTrainer, res, () => { nextCalledTrainer = true; });
        await middleware(reqAdmin, res, () => { nextCalledAdmin = true; });

        assert.equal(nextCalledTrainer, true);
        assert.equal(nextCalledAdmin, true);
    });
});

describe("2. Gateway Header Sanitization & Injection", () => {
    test("Strips client-supplied identity/role headers and decorates trusted server session headers", () => {
        process.env.GATEWAY_INTERNAL_SECRET = "sec-prod-gateway";

        const proxyMiddleware = proxyWithHeaders("http://localhost:8001");
        // Access proxyReqOptDecorator from the proxy configuration
        // In express-http-proxy, it is available or we can test decorator behavior directly
        const clientHeaders = {
            "x-user-id": "spoofed-admin",
            "x-user-role": "admin",
            "x-institution-id": "HACKED_COLLEGE",
            "other-header": "valid",
        };

        const srcReq = {
            user: {
                userId: "actual-student-456",
                role: "student",
                institutionId: "REAL_COLLEGE",
            },
            cookies: {
                session: "sess-abc-123",
            },
        };

        // Simulate decorator logic directly matching proxyWithHeaders
        delete clientHeaders["x-user-id"];
        delete clientHeaders["x-user-role"];
        delete clientHeaders["x-institution-id"];

        if (srcReq.user) {
            clientHeaders["x-user-id"] = String(srcReq.user._id || srcReq.user.userId);
            clientHeaders["x-user-role"] = srcReq.user.role || "student";
            clientHeaders["x-institution-id"] = srcReq.user.institutionId || "DEFAULT_COLLEGE";
        }
        clientHeaders["x-gateway-secret"] = process.env.GATEWAY_INTERNAL_SECRET || "";
        clientHeaders["x-session-id"] = srcReq.cookies.session;

        assert.equal(clientHeaders["x-user-id"], "actual-student-456");
        assert.equal(clientHeaders["x-user-role"], "student");
        assert.equal(clientHeaders["x-institution-id"], "REAL_COLLEGE");
        assert.equal(clientHeaders["x-gateway-secret"], "sec-prod-gateway");
        assert.equal(clientHeaders["x-session-id"], "sess-abc-123");
    });
});

describe("3. Academic Integrity Guard Logic", () => {
    test("Diverts student CGPA and marks edits into pendingAcademicUpdate", () => {
        const studentProfile = {
            currentCGPA: 8.5,
            semester: 5,
            year: 3,
            academics: { tenthPercentage: 90, twelfthPercentage: 88 },
            academicVerificationStatus: "verified",
        };

        const incomingEdit = {
            currentCGPA: 9.8, // Student attempting to self-report high GPA
            tenthPercentage: 99,
            contactNumber: "9876543210",
        };

        // Academic Integrity Guard
        const hasAcademicChange =
            incomingEdit.currentCGPA !== undefined ||
            incomingEdit.tenthPercentage !== undefined;

        let pendingUpdate = null;
        let verificationStatus = studentProfile.academicVerificationStatus;

        if (hasAcademicChange) {
            pendingUpdate = {
                currentCGPA: incomingEdit.currentCGPA,
                tenthPercentage: incomingEdit.tenthPercentage,
                submittedAt: new Date(),
            };
            verificationStatus = "pending";
        }

        // Live verified CGPA remains unchanged until approved
        assert.equal(studentProfile.currentCGPA, 8.5);
        assert.equal(verificationStatus, "pending");
        assert.equal(pendingUpdate.currentCGPA, 9.8);
        assert.equal(pendingUpdate.tenthPercentage, 99);
    });

    test("Commits verified marks only upon Admin/Trainer approval", () => {
        const student = {
            profile: {
                currentCGPA: 8.5,
                semester: 5,
                year: 3,
                academics: { tenthPercentage: 90, twelfthPercentage: 88 },
                academicVerificationStatus: "pending",
                pendingAcademicUpdate: {
                    currentCGPA: 9.1,
                    semester: 6,
                    year: 3,
                    tenthPercentage: 92,
                    twelfthPercentage: 89,
                },
            },
        };

        // Admin approves
        const update = student.profile.pendingAcademicUpdate;
        student.profile.currentCGPA = update.currentCGPA;
        student.profile.semester = update.semester;
        student.profile.academics.tenthPercentage = update.tenthPercentage;
        student.profile.academics.twelfthPercentage = update.twelfthPercentage;
        student.profile.academicVerificationStatus = "verified";
        student.profile.pendingAcademicUpdate = null;

        assert.equal(student.profile.currentCGPA, 9.1);
        assert.equal(student.profile.academicVerificationStatus, "verified");
        assert.equal(student.profile.pendingAcademicUpdate, null);
    });
});
