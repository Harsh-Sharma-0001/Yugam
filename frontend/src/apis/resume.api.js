import api from "../utils/axios";

export const getResume = async () => {
  try {
    const response = await api.get("/api/resume/get-resume");
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }

    console.error("Get Resume API Error:", error);
    throw error;
  }
};

export const getResumeRoles = async () => {
  try {
    const response = await api.get("/api/resume/roles");
    return response.data.data;
  } catch (error) {
    console.error("Get Resume Roles Error:", error);
    throw error;
  }
};
