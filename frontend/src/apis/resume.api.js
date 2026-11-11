import api from "../utils/axios";

export const getResume = async () => {
  try {
    const response = await api.get("/api/resume/get-resume");
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return { success: true, data: null, resume: null };
    }

    console.error("Get Resume API Error:", error?.message);
    return { success: false, data: null, resume: null };
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

export const uploadResumeApi = async (formData) => {
  try {
    const response = await api.post("/api/resume/upload", formData);
    return response.data;
  } catch (error) {
    console.error("Upload Resume API Error:", error);
    throw error;
  }
};
