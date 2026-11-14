import proxy from "express-http-proxy";

export const proxyWithHeaders = (serviceUrl) => {
    return proxy(
        serviceUrl,
        {
            proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
                if (srcReq.user) {
                    proxyReqOpts.headers["x-user-id"] = String(srcReq.user._id || srcReq.user.userId);
                } else {
                    delete proxyReqOpts.headers["x-user-id"];
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