export const formatTime = (time) => {
  const hours = Math.floor(time / 3600);
  const minutes = Math.floor((time % 3600) / 60);
  const seconds = Math.floor(time % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
};

export const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text);
  return true;
};

// YouTube utility functions
export const extractYouTubeVideoId = (url) => {
  if (!url) return null;
  
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
};

export const isValidYouTubeUrl = (url) => {
  return extractYouTubeVideoId(url) !== null;
};

export const getYouTubeEmbedUrl = (videoId, autoplay = false, startTime = 0) => {
  if (!videoId) return null;
  
  const params = new URLSearchParams({
    enablejsapi: '1',
    origin: window.location.origin,
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    controls: '0', // Disable YouTube's native controls
    showinfo: '0',
    iv_load_policy: '3',
    fs: '1',
    cc_load_policy: '0',
    disablekb: '1' // Disable keyboard controls
  });
  
  if (autoplay) params.append('autoplay', '1');
  if (startTime > 0) params.append('start', Math.floor(startTime));
  
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
};

export const getYouTubeThumbnailUrl = (videoId, quality = 'hqdefault') => {
  if (!videoId) return null;
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
};