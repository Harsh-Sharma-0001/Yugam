import proxy from "express-http-proxy";

export const proxyWithHeaders = (serviceUrl) => {
    return proxy(
        serviceUrl,
        {
            proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
                // Strip client-supplied identity / role / institution headers to prevent spoofing
                delete proxyReqOpts.headers["x-user-id"];
                delete proxyReqOpts.headers["x-user-role"];
                delete proxyReqOpts.headers["x-institution-id"];

                if (srcReq.user) {
                    proxyReqOpts.headers["x-user-id"] = String(srcReq.user._id || srcReq.user.userId);
                    proxyReqOpts.headers["x-user-role"] = srcReq.user.role || "student";
                    proxyReqOpts.headers["x-institution-id"] = srcReq.user.institutionId || "DEFAULT_COLLEGE";
                }

                proxyReqOpts.headers["x-gateway-secret"] = process.env.GATEWAY_INTERNAL_SECRET || "";

                if (srcReq.cookies?.session) {
                    proxyReqOpts.headers["x-session-id"] = srcReq.cookies.session;
                }
                return proxyReqOpts;
            }
        }
    );
};
