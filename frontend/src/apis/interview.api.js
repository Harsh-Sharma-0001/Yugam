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
