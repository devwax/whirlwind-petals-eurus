if (!window.Eurus.loadedScript.has('video.js')) {
  window.Eurus.loadedScript.add('video.js');

  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.store('xVideo', {
        ytIframeId: 0,
        vimeoIframeId: 0,
        externalListened: false,

        togglePlay(el) {
          const videoContainer = el.closest('.external-video');
          let video = el.getElementsByClassName('video')[0];
          if (!video && el.closest('.contain-video')) {
            video = el.closest('.contain-video').getElementsByClassName('video')[0];
          }
          if (video) {
            if (videoContainer) {
              video.paused ? videoContainer.classList.remove('function-paused') : videoContainer.classList.add('function-paused');
              const buttonPlay = videoContainer.getElementsByClassName('button-play')[0];
              if (buttonPlay) {
                video.paused ? buttonPlay.classList.remove('hidden') : buttonPlay.classList.add('hidden');
              }  
            }
            video.paused ? this.play(el) : this.pause(el);
          }
        },
        play(el) {
          const videoContainer = el.closest('.external-video');
          let video = el.getElementsByClassName('video')[0];
          if (!video && el.closest('.contain-video')) {
            video = el.closest('.contain-video').getElementsByClassName('video')[0];
          }
          if (video) {
            if (videoContainer) {
              const buttonPlay = videoContainer.getElementsByClassName('button-play')[0];
              if (video.tagName == 'IFRAME') {
                if (videoContainer.classList.contains('function-paused')) this.externalPostCommand(video, 'play');
                videoContainer.classList.remove('function-paused');
              } else if (video.tagName == 'VIDEO') {
                if (!videoContainer.classList.contains('function-paused')) {
                  if (buttonPlay) buttonPlay.classList.add('hidden');
                  video.play().catch((error) => {
                    if (buttonPlay) buttonPlay.classList.remove('hidden');
                  });
                }
              }
            }
          }
        },
        pause(el) {
          const videoContainer = el.closest('.external-video');
          let video = el.getElementsByClassName('video')[0];
          if (!video && el.closest('.contain-video')) {
            video = el.closest('.contain-video').getElementsByClassName('video')[0];
          }
          if (video) {
            if (videoContainer) {
              const buttonPlay = videoContainer.getElementsByClassName('button-play')[0];
              if (video.tagName == 'IFRAME') {
                if (!videoContainer.classList.contains('paused')) {
                  videoContainer.classList.add('function-paused');
                }
                this.externalPostCommand(video, 'pause');
              } else if (video.tagName == 'VIDEO') {
                if (buttonPlay) buttonPlay.classList.remove('hidden');
                video.pause();
              }
            }
          }
        },
        load(el) {
          el?.classList.add('active');
          el?.closest('.animate_transition_card__image')?.classList.remove('animate-Xpulse', 'skeleton-image');
          setTimeout(() => { el.closest('.animate_transition_card__image')?.classList.add('lazy_active'); }, 250);  
        },
        mp4Thumbnail(el) {
          const videoContainer = el.closest('.external-video');
          const imgThumbnail = videoContainer.getElementsByClassName('img-thumbnail')[0];
          const imgThumbnailMobile = videoContainer.getElementsByClassName('img-thumbnail')[1];
          if (imgThumbnail) {
            imgThumbnail.classList.add('hidden');
            imgThumbnail.classList.add('md:hidden');
          }
          if (imgThumbnailMobile) {
            imgThumbnailMobile.classList.add('hidden');
          }
          this.togglePlay(el);
        },
        removeThumbnail(el){
          const videoContainer = el.closest('.external-video');
          const imgThumbnail = videoContainer.getElementsByClassName('img-thumbnail')[0];
          const imgThumbnailMobile = videoContainer.getElementsByClassName('img-thumbnail')[1];
          if (imgThumbnail) {
            imgThumbnail.classList.add('hidden');
            imgThumbnail.classList.add('md:hidden');
          }
          if (imgThumbnailMobile) {
            imgThumbnailMobile.classList.add('hidden');
          }
        },
        externalLoad(el, host, id, loop, title, controls = 1) {
          let src = '';
          let pointerEvent = '';
          if (host == 'youtube') {
            src = `https://www.youtube.com/embed/${id}?mute=1&playlist=${id}&autoplay=1&playsinline=1&enablejsapi=1&modestbranding=1&rel=0&controls=${controls}&showinfo=${controls}`;
          } else {
            src = `https://player.vimeo.com/video/${id}?muted=1&autoplay=1&playsinline=1&api=1&controls=${controls}`;
          }
  
          if (controls == 0) {
            pointerEvent = " pointer-events-none";
          }
          requestAnimationFrame(() => {
            const videoContainer = el.closest('.external-video');
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);
            const borderRadiusClass = (isIOS && videoContainer.classList.contains('rounded-[10px]')) ? 'rounded-[10px]' : '';
            videoContainer.innerHTML = `<iframe data-video-loop="${loop}" class="iframe-video absolute w-full h-full video top-1/2 -translate-y-1/2 ${borderRadiusClass} ${pointerEvent}"
              frameborder="0" host="${host}" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen playsinline
              src="${src}" title="${title}"></iframe>`;
  
            videoContainer.querySelector('.iframe-video').addEventListener("load", () => {
              setTimeout(() => {
                this.play(videoContainer);
  
                if (host == 'youtube') {
                  this.ytIframeId++;
                  videoContainer.querySelector('.iframe-video').contentWindow.postMessage(JSON.stringify({
                    event: 'listening',
                    id: this.ytIframeId,
                    channel: 'widget'
                  }), '*');
                  videoContainer.querySelector('.iframe-video').contentWindow.postMessage(JSON.stringify({
                    event: 'command',
                    func: 'addEventListener',
                    args: ['onStateChange'],
                    id: this.ytIframeId,
                    channel: 'widget'
                  }), '*');
                } else {
                  this.vimeoIframeId++;
                  videoContainer.querySelector('.iframe-video').contentWindow.postMessage(JSON.stringify({
                    method: 'addEventListener',
                    value: 'finish'
                  }), '*');
                  videoContainer.querySelector('.iframe-video').contentWindow.postMessage(JSON.stringify({
                    method: 'addEventListener',
                    value: 'play'
                  }), '*');
                  videoContainer.querySelector('.iframe-video').contentWindow.postMessage(JSON.stringify({
                    method: 'addEventListener',
                    value: 'pause'
                  }), '*');
                  videoContainer.querySelector('.iframe-video').contentWindow.postMessage(JSON.stringify({
                    method: 'addEventListener',
                    value: 'playProgress'
                  }), '*')
                }
              }, 100);
            });
          });
  
          this.externalListen();
        },
        renderVimeoFacade(el, id, options) {
          fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${id}&width=${options.width}`)
            .then(reponse => {
              return reponse.json();
            }).then((response) => {
              const html = `
                <picture>
                  <img src="${response.thumbnail_url}" loading="lazy" class="w-full h-full object-cover" alt="${options.alt}" width="${response.width}" height="${response.height}"/>
                </picture>
              `;
              
              requestAnimationFrame(() => {
                el.innerHTML = html;
              });
            });
        },
        externalListen() {
          if (!this.externalListened) {
            window.addEventListener('message', (event) => {
              var iframes = document.getElementsByTagName('IFRAME');
  
              for (let i = 0, iframe, win, message; i < iframes.length; i++) {
                iframe = iframes[i];
  
                // Cross-browser way to get iframe's window object
                win = iframe.contentWindow || iframe.contentDocument.defaultView;
  
                if (win === event.source) {
                  if (event.origin == 'https://www.youtube.com') {
                    message = JSON.parse(event.data);
                    if (iframe.getAttribute('data-video-loop') === 'true') {
                      if (message.info && message.info.playerState == 0) {
                        this.externalPostCommand(iframe, 'play');
                      }  
                    }
                    if (message.info && message.info.playerState == 1) {
                      iframe.parentNode.classList.remove('paused');
                      iframe.parentNode.classList.remove('function-paused');
                    }
                    if (message.info && message.info.playerState == 2) {
                      iframe.parentNode.classList.add('paused');
                    }
                  }
  
                  if (event.origin == 'https://player.vimeo.com') {
                    message = JSON.parse(event.data);
                    if (iframe.getAttribute('data-video-loop') !== 'true') {
                      if (message.event == "finish") {
                        this.externalPostCommand(iframe, 'play');
                      }
                    }
                    if (message.event === 'play') {
                      iframe.parentNode.classList.remove('paused');
                      iframe.parentNode.classList.remove('function-paused');
                    }
                    if (message.event === 'pause') {
                      iframe.parentNode.classList.add('paused');
                    }
                  }
                }
              }
            });
  
            this.externalListened = true;
          }
        },
        externalPostCommand(iframe, cmd) {
          const host = iframe.getAttribute('host');
          const command = host == 'youtube' ? {
            "event": "command",
            "func": cmd + "Video"
          } : {
            "method": cmd,
            "value": "true"
          };
  
          iframe.contentWindow.postMessage(JSON.stringify(command), '*');
        },
        toggleMute(el) {
          let video = el.closest('.video-hero') && el.closest('.video-hero').getElementsByClassName('video')[0];
          if (!video && el.closest('.contain-video')) {
            video = el.closest('.contain-video').getElementsByClassName('video')[0];
          }
          if (video) {
             if (video.tagName != 'IFRAME') {
                video.muted = !video.muted;
             }
          }
        }
      });
    }); 
  });
}