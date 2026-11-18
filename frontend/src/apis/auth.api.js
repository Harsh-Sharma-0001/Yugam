import api from "../utils/axios";

export const AUTH_STATUS = {
  LOADING: "loading",
  AUTHENTICATED: "authenticated",
  UNAUTHENTICATED: "unauthenticated",
  NETWORK_ERROR: "networkError",
};

/**
 * Robust current user resolver distinguishing:
 * - 200: AUTH_STATUS.AUTHENTICATED
 * - 401/403: AUTH_STATUS.UNAUTHENTICATED
 * - 5xx / Network / Timeout: AUTH_STATUS.NETWORK_ERROR
 */
export const checkAuthStatus = async () => {
  try {
    const response = await api.get("/api/me");
    if (response.data?.user) {
      return {
        status: AUTH_STATUS.AUTHENTICATED,
        user: response.data.user,
        data: response.data,
      };
    }
    return {
      status: AUTH_STATUS.UNAUTHENTICATED,
      user: null,
      data: null,
    };
  } catch (error) {
    const statusCode = error.response?.status;
    if (statusCode === 401 || statusCode === 403) {
      return {
        status: AUTH_STATUS.UNAUTHENTICATED,
        user: null,
        error: error.response?.data?.message || "Unauthorized",
      };
    }

    return {
      status: AUTH_STATUS.NETWORK_ERROR,
      user: null,
      error: error.message || "Transient server or network connectivity error.",
      isTransient: true,
    };
  }
};

export const getCurrentUser = async () => {
  const result = await checkAuthStatus();
  if (result.status === AUTH_STATUS.AUTHENTICATED) {
    return result.data;
  }
  if (result.status === AUTH_STATUS.NETWORK_ERROR) {
    return { error: result.error, isNetworkError: true, user: null };
  }
  return null;
};
