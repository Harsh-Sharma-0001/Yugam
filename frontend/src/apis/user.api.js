import api from "../utils/axios";

export const getCurrentUser = async () => {
  try {
    const response = await api.get("/api/me");
    return response.data;
  } catch (error) {
    return null;
  }
};

export const useCoins = async (data) => {
  try {
    const response = await api.post("/api/auth/use-coins", data);
    return response.data;
  } catch (error) {
    console.error("Use coins error:", error);
    throw error;
  }
};

export const updateProfile = async (profileData) => {
  try {
    const response = await api.put("/api/auth/profile", profileData);
    return response.data;
  } catch (error) {
    console.error("updateProfile error:", error);
    throw error;
  }
};

export const verifyStudentAcademics = async (studentId, data) => {
  try {
    const response = await api.patch(`/api/auth/students/${studentId}/verify-academics`, data);
    return response.data;
  } catch (error) {
    console.error("verifyStudentAcademics error:", error);
    throw error;
  }
};

export const updateUserRole = async (targetUserId, data) => {
  try {
    const response = await api.patch(`/api/auth/users/${targetUserId}/role`, data);
    return response.data;
  } catch (error) {
    console.error("updateUserRole error:", error);
    throw error;
  }
};

export const provisionUsers = async (data) => {
  try {
    const response = await api.post("/api/auth/admin/provision-users", data);
    return response.data;
  } catch (error) {
    console.error("provisionUsers error:", error);
    throw error;
  }
};

export const getInstitutionUsers = async (params = {}) => {
  try {
    const response = await api.get("/api/auth/users", { params });
    return response.data;
  } catch (error) {
    console.error("getInstitutionUsers error:", error);
    throw error;
  }
};

export const getPendingVerifications = async () => {
  try {
    const response = await api.get("/api/auth/students/pending-verifications");
    return response.data;
  } catch (error) {
    console.error("getPendingVerifications error:", error);
    throw error;
  }
};

export const getAuditLogs = async () => {
  try {
    const response = await api.get("/api/auth/audit-logs");
    return response.data;
  } catch (error) {
    console.error("getAuditLogs error:", error);
    throw error;
  }
};

// Tasks & Assignments API
export const getTasks = async (params = {}) => {
  try {
    const response = await api.get("/api/interview/tasks", { params });
    return response.data;
  } catch (error) {
    console.error("getTasks error:", error);
    throw error;
  }
};

export const createTask = async (taskData) => {
  try {
    const response = await api.post("/api/interview/tasks", taskData);
    return response.data;
  } catch (error) {
    console.error("createTask error:", error);
    throw error;
  }
};

export const submitTask = async (taskId, submissionData) => {
  try {
    const response = await api.post(`/api/interview/tasks/${taskId}/submit`, submissionData);
    return response.data;
  } catch (error) {
    console.error("submitTask error:", error);
    throw error;
  }
};

export const getTaskSubmissions = async (taskId) => {
  try {
    const response = await api.get(`/api/interview/tasks/${taskId}/submissions`);
    return response.data;
  } catch (error) {
    console.error("getTaskSubmissions error:", error);
    throw error;
  }
};

export const reviewSubmission = async (taskId, submissionId, reviewData) => {
  try {
    const response = await api.patch(`/api/interview/tasks/${taskId}/submissions/${submissionId}`, reviewData);
    return response.data;
  } catch (error) {
    console.error("reviewSubmission error:", error);
    throw error;
  }
};
