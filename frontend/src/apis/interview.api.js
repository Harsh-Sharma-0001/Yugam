import api from "../utils/axios";

export const startInterview = async (data) => {
  try {
    const response = await api.post("/api/interview/start", data);
    return response.data;
  } catch (error) {
    console.error("Start interview error:", error);
    throw error;
  }
};

export const getInterview = async (id) => {
  try {
    const response = await api.get(`/api/interview/${id}`);
    return response.data;
  } catch (error) {
    console.error("Get interview error:", error);
    return error.response?.data || null;
  }
};

export const submitAnswer = async (data) => {
  try {
    const response = await api.post(`/api/interview/answer`, data);
    return response.data;
  } catch (error) {
    console.error("Submit answer error:", error);
    return error.response?.data || {
      success: false,
      message: error.response?.data?.message || error.message || "Failed to submit answer.",
    };
  }
};

export const getAllInterviews = async () => {
  try {
    const response = await api.get(`/api/interview/all`);
    return response.data;
  } catch (error) {
    console.error("Get all interviews error:", error);
    return error.response?.data || null;
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
        ? "Code execution engine is currently unavailable."
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

export const getStudentsPerformanceDirectory = async (params = {}) => {
  try {
    const response = await api.get("/api/interview/students-directory", { params });
    return response.data;
  } catch (error) {
    console.error("getStudentsPerformanceDirectory error:", error);
    return error.response?.data || { success: false, message: error.message };
  }
};

export const exportStudentsDirectoryFile = async (format = "csv", params = {}) => {
  try {
    const response = await api.get("/api/interview/students-directory/export", {
      params: { ...params, format },
      responseType: "blob",
    });

    const blob = new Blob([response.data], {
      type:
        format === "xlsx"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "text/csv;charset=utf-8;",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Yugam_Student_Report.${format}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return { success: true };
  } catch (error) {
    console.error("exportStudentsDirectoryFile error:", error);
    return { success: false, message: "Export download failed." };
  }
};

export const scheduleInterview = async (data) => {
  try {
    const response = await api.post("/api/interview/schedule", data);
    return response.data;
  } catch (error) {
    console.error("scheduleInterview error:", error);
    throw error;
  }
};

export const getScheduledInterviews = async (params = {}) => {
  try {
    const response = await api.get("/api/interview/schedule", { params });
    return response.data;
  } catch (error) {
    console.error("getScheduledInterviews error:", error);
    return error.response?.data || { success: false, scheduledInterviews: [] };
  }
};

export const updateScheduleStatus = async (id, data) => {
  try {
    const response = await api.patch(`/api/interview/schedule/${id}/status`, data);
    return response.data;
  } catch (error) {
    console.error("updateScheduleStatus error:", error);
    throw error;
  }
};
