// YouTube Player Manager
class YouTubePlayerManager {
  constructor() {
    this.player = null;
    this.isReady = false;
    this.onReadyCallback = null;
    this.onStateChangeCallback = null;
    this.onTimeUpdateCallback = null;
    this.timeUpdateInterval = null;
  }

  // Initialize YouTube player
  initializePlayer(containerId, videoId, options = {}) {
    return new Promise((resolve, reject) => {
      if (typeof YT === 'undefined' || !YT.Player) {
        reject(new Error('YouTube API not loaded'));
        return;
      }

      const defaultOptions = {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
          enablejsapi: 1,
          origin: window.location.origin,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          controls: 0, // Disable YouTube's native controls
          showinfo: 0,
          iv_load_policy: 3,
          fs: 1,
          cc_load_policy: 0,
          disablekb: 1, // Disable keyboard controls
          ...options.playerVars
        },
        events: {
          onReady: (event) => {
            this.player = event.target;
            this.isReady = true;
            this.setupEventListeners();
            if (this.onReadyCallback) {
              this.onReadyCallback(event);
            }
            resolve(event);
          },
          onStateChange: (event) => {
            this.handleStateChange(event);
            if (this.onStateChangeCallback) {
              this.onStateChangeCallback(event);
            }
          },
          onError: (event) => {
            console.error('YouTube Player Error:', event);
            reject(event);
          }
        }
      };

      const finalOptions = { ...defaultOptions, ...options };
      new YT.Player(containerId, finalOptions);
    });
  }

  // Setup event listeners
  setupEventListeners() {
    if (!this.player) return;

    // Start time update interval
    this.startTimeUpdateInterval();
  }

  // Handle state changes
  handleStateChange(event) {
    const state = event.data;
    
    switch (state) {
      case YT.PlayerState.PLAYING:
        this.startTimeUpdateInterval();
        break;
      case YT.PlayerState.PAUSED:
      case YT.PlayerState.ENDED:
        this.stopTimeUpdateInterval();
        break;
    }
    
    // Notify external listeners about state change
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(event);
    }
  }

  // Start time update interval
  startTimeUpdateInterval() {
    this.stopTimeUpdateInterval();
    this.timeUpdateInterval = setInterval(() => {
      if (this.player && this.onTimeUpdateCallback) {
        const currentTime = this.player.getCurrentTime();
        this.onTimeUpdateCallback(currentTime);
      }
    }, 1000);
  }

  // Stop time update interval
  stopTimeUpdateInterval() {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
  }

  // Player control methods
  playVideo() {
    if (this.player && this.isReady) {
      this.player.playVideo();
    }
  }

  pauseVideo() {
    if (this.player && this.isReady) {
      this.player.pauseVideo();
    }
  }

  stopVideo() {
    if (this.player && this.isReady) {
      this.player.stopVideo();
    }
  }

  seekTo(seconds, allowSeekAhead = true) {
    if (this.player && this.isReady) {
      this.player.seekTo(seconds, allowSeekAhead);
    }
  }

  getCurrentTime() {
    if (this.player && this.isReady) {
      return this.player.getCurrentTime();
    }
    return 0;
  }

  getDuration() {
    if (this.player && this.isReady) {
      return this.player.getDuration();
    }
    return 0;
  }

  getPlayerState() {
    if (this.player && this.isReady) {
      return this.player.getPlayerState();
    }
    return -1;
  }

  isPlaying() {
    return this.getPlayerState() === YT.PlayerState.PLAYING;
  }

  isPaused() {
    return this.getPlayerState() === YT.PlayerState.PAUSED;
  }

  // Set callbacks
  setOnReady(callback) {
    this.onReadyCallback = callback;
  }

  setOnStateChange(callback) {
    this.onStateChangeCallback = callback;
  }

  setOnTimeUpdate(callback) {
    this.onTimeUpdateCallback = callback;
  }

  // Cleanup
  destroy() {
    this.stopTimeUpdateInterval();
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
    this.isReady = false;
  }
}

// Global YouTube API ready handler
window.onYouTubeIframeAPIReady = () => {
  console.log('YouTube API loaded');
};

export default YouTubePlayerManager;
