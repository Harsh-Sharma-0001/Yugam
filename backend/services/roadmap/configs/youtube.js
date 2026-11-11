import dotenv from "dotenv";
dotenv.config();
import axios from "axios";

const BASE_URL = "https://www.googleapis.com/youtube/v3/search";

const searchVideo = async (topic, role = "") => {
  const cleanTopic = String(topic || "").trim();
  const cleanRole = String(role || "").trim();
  const defaultQuery = cleanRole ? `${cleanTopic} ${cleanRole} complete tutorial` : `${cleanTopic} complete tutorial`;
  const fallbackUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(defaultQuery)}`;

  if (!process.env.YOUTUBE_API_KEY) {
    return {
      title: `${cleanTopic} Tutorial`,
      channel: "YouTube",
      url: fallbackUrl,
    };
  }

  try {
    const { data } = await axios.get(BASE_URL, {
      params: {
        key: process.env.YOUTUBE_API_KEY,
        part: "snippet",
        q: defaultQuery,
        maxResults: 1,
        type: "video",
      },
    });

    if (data?.items && data.items.length > 0) {
      const video = data.items[0];
      const videoId = video.id?.videoId;
      if (videoId) {
        return {
          title: video.snippet?.title || `${cleanTopic} Tutorial`,
          channel: video.snippet?.channelTitle || "YouTube",
          url: `https://www.youtube.com/watch?v=${videoId}`,
        };
      }
    }

    return {
      title: `${cleanTopic} Tutorial`,
      channel: "YouTube",
      url: fallbackUrl,
    };
  } catch (error) {
    console.warn("YouTube API search warning:", error?.message);
    return {
      title: `${cleanTopic} Tutorial`,
      channel: "YouTube",
      url: fallbackUrl,
    };
  }
};

export default searchVideo;
