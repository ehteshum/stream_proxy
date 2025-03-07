const videoPlayer = document.getElementById('videoPlayer');
const loadingOverlay = document.querySelector('.loading-overlay');
const errorOverlay = document.querySelector('.error-overlay');
let hls = null;

function showLoading(show) {
    loadingOverlay.style.display = show ? 'flex' : 'none';
}

function showError(show, message = 'Stream error occurred') {
    errorOverlay.style.display = show ? 'flex' : 'none';
    errorOverlay.querySelector('.error-message').textContent = message;
}

function loadStream() {
    const streamUrl = CONFIG.streamUrl;
    if (!streamUrl) return;

    showError(false);
    showLoading(true);

    if (hls) {
        hls.destroy();
        hls = null;
    }

    if (Hls.isSupported()) {
        const hlsConfig = {
            debug: false,
            enableWorker: true,
            lowLatencyMode: false, // Changed to false for better buffering
            backBufferLength: 90,  // Increased buffer length
            maxBufferLength: 60,   // Increased max buffer
            maxMaxBufferLength: 600, // Allow for much larger buffer when bandwidth allows
            maxBufferSize: 60 * 1000 * 1000, // 60MB buffer size
            manifestLoadingTimeOut: 20000, // Increased timeout
            manifestLoadingMaxRetry: 6,    // More retries
            manifestLoadingRetryDelay: 500, // Faster retry
            levelLoadingTimeOut: 20000,     // Increased timeout
            levelLoadingMaxRetry: 6,        // More retries
            levelLoadingRetryDelay: 500,    // Faster retry
            fragLoadingTimeOut: 20000,      // Increased timeout
            fragLoadingMaxRetry: 6,         // More retries
            fragLoadingRetryDelay: 500,     // Faster retry
            startLevel: -1,
            abrEwmaDefaultEstimate: 500000, // Start with a higher bandwidth estimate (500kbps)
            abrBandWidthFactor: 0.95,      // Be slightly more conservative with ABR decisions
            abrBandWidthUpFactor: 0.7,     // Allow faster upgrades to higher quality
            abrMaxWithRealBitrate: true,   // Use real bitrate for ABR decisions
            testBandwidth: true,
            progressive: true,
            xhrSetup: function(xhr, url) {
                xhr.withCredentials = false; // Ensure CORS requests don't send credentials
            }
        };

        hls = new Hls(hlsConfig);

        hls.on(Hls.Events.ERROR, function(event, data) {
            if (data.fatal) {
                switch(data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        console.error('Network error:', data.details);
                        showError(true, 'Network error occurred. Retrying...');
                        setTimeout(() => {
                            hls.startLoad();
                        }, 1000);
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        console.error('Media error:', data.details);
                        showError(true, 'Media error occurred. Recovering...');
                        setTimeout(() => {
                            hls.recoverMediaError();
                        }, 1000);
                        break;
                    default:
                        console.error('Fatal error:', data.details);
                        showError(true, 'Fatal error occurred. Please try again.');
                        break;
                }
            } else {
                console.warn('Non-fatal error:', data.details);
            }
        });

        hls.on(Hls.Events.MANIFEST_LOADING, () => {
            showLoading(true);
            showError(false);
            console.log('Manifest loading...');
        });

        hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
            showLoading(false);
            console.log('Manifest parsed, found ' + data.levels.length + ' quality levels');
            playVideo();
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
            console.log('Quality level switched to ' + data.level);
        });

        try {
            hls.attachMedia(videoPlayer);
            hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                console.log('Media attached, loading source...');
                hls.loadSource(streamUrl);
            });
        } catch (error) {
            console.error('Player initialization error:', error);
            showError(true, 'Failed to initialize player. Please try again.');
        }
    } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        videoPlayer.src = streamUrl;
        videoPlayer.addEventListener('loadedmetadata', playVideo);
    } else {
        showError(true, 'Your browser does not support HLS playback.');
    }
}

function playVideo() {
    try {
        if (videoPlayer.paused) {
            const playPromise = videoPlayer.play();
            if (playPromise !== undefined) {
                playPromise.catch((error) => {
                    console.error('Play error:', error);
                    // Autoplay was prevented, try with muted
                    videoPlayer.muted = true;
                    videoPlayer.play().catch(e => {
                        console.error('Muted play error:', e);
                        showError(true, 'Playback blocked by browser. Please click to play.');
                    });
                });
            }
        }
    } catch (error) {
        console.error('Playback error:', error);
        showError(true, 'Playback error occurred.');
    }
}

// Add a preload buffer before playing
videoPlayer.addEventListener('canplaythrough', () => {
    showLoading(false);
});

videoPlayer.addEventListener('error', (e) => {
    console.error('Video error:', videoPlayer.error);
    showError(true, 'Video playback error. Retrying...');
    setTimeout(loadStream, 2000);
});

videoPlayer.addEventListener('stalled', () => {
    console.warn('Playback stalled');
    showLoading(true);
    setTimeout(() => {
        if (videoPlayer.readyState < 3) {
            console.log('Still stalled after timeout, reloading stream');
            loadStream();
        }
    }, 8000); // Increased timeout before reload
});

videoPlayer.addEventListener('playing', () => {
    console.log('Playback started');
    showLoading(false);
    showError(false);
});

videoPlayer.addEventListener('waiting', () => {
    console.log('Buffering...');
    showLoading(true);
});

videoPlayer.addEventListener('canplay', () => {
    console.log('Can play');
    showLoading(false);
});

// Add a click handler to the video container to help with autoplay issues
document.querySelector('.video-container').addEventListener('click', () => {
    if (videoPlayer.paused) {
        playVideo();
    }
});

document.addEventListener('DOMContentLoaded', loadStream);
