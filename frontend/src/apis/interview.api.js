import api from "../utils/axios";

export const startInterview = async (data) => {
  try {
    const response = await api.post("/api/interview/start", data);
    return response.data;
  } catch (error) {
    console.error("Start interview error:", error);
    return null;
  }
};

export const getInterview = async (id) => {
  try {
    const response = await api.get(`/api/interview/${id}`);
    return response.data;
  } catch (error) {
    console.error("Get interview error:", error);
    return null;
  }
};

export const submitAnswer = async (data) => {
  try {
    const response = await api.post(`/api/interview/answer`, data);
    return response.data;
  } catch (error) {
    console.error("Submit answer error:", error);
    return null;
  }
};

export const getAllInterviews = async () => {
  try {
    const response = await api.get(`/api/interview/all`);
    return response.data;
  } catch (error) {
    console.error("Get all interviews error:", error);
    return null;
  }
};

export const executeCode = async ({ language, source_code, stdin }) => {
  try {
    const response = await api.post("/api/interview/code/run", {
      language,
      source_code,
      stdin,
    });
    return response.data;
  } catch (error) {
    console.error("Execute code error:", error);
    const message =
      error.response?.data?.message ||
      (error.response?.status === 503
        ? "Code execution service is currently offline."
        : "Failed to execute code.");
    return {
      success: false,
      message,
    };
  }
};

export const pollCodeStatus = async (token) => {
  try {
    const response = await api.get(`/api/interview/code/status/${token}`);
    return response.data;
  } catch (error) {
    console.error("Poll code status error:", error);
    const message =
      error.response?.data?.message || "Failed to retrieve execution status.";
    return {
      success: false,
      message,
    };
  }
};
