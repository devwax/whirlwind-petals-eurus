if (!window.Eurus.loadedScript.has('video-looping.js')) {
  window.Eurus.loadedScript.add('video-looping.js');

  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.data('xVideoLooping', (spacing, autoplay, showPagination, cardProductPosition, sectionId, swipeOnMobile, applyBlackWhiteEffect) => ({
        activeIndex: 0,
        slideList: [],
        originalHeight: 0,
        originalCountItem: 0,
        startSwipePosition: 0,
        isSwiping: 0,
        initVideoLooping() {
          if (window.innerWidth > 767) {
            this.initSlider()
          } else {
            if (swipeOnMobile) {
              this.initSlider()
            }
          }
        },
        initSlider() {
          const container = document.querySelector(`.slider-${sectionId}`);
          let originalItems = Array.from(document.querySelectorAll(`.slider-${sectionId} .item`));
      
          const preloadItem = document.getElementById(`preload-slide-${sectionId}`);
          this.originalCountItem = originalItems.length;
          this.originalHeight = preloadItem.offsetHeight;
          container.style.height = `${this.originalHeight}px`;

          if (originalItems.length == 1) {
            originalItems[this.activeIndex].style.height=`${this.originalHeight}px`;
            this.renderPagination();
          }
          if (originalItems.length > 1) {
            if (window.innerWidth > 767) {
              while (originalItems.length < 7) {
                originalItems = originalItems.concat(
                  originalItems.map(item => {
                    const clone = item.cloneNode(true);
                    clone.setAttribute('is-clone', true)
                    return clone
                  })
                );
              }
              const frag = document.createDocumentFragment();
              originalItems.forEach(item => frag.appendChild(item));

              container.innerHTML = '';
              container.appendChild(frag); 
              
              this.slideList= Array.from(document.querySelectorAll(`.slider-${sectionId} .item`));  
              this.slideList = this.slideList.map((item, index)=>{
                item.setAttribute('slide-index', index);
                return item
              });
            } else {
              this.slideList = originalItems
            }
            if (!('requestIdleCallback' in window)) {
              setTimeout(() => {
                this.render()
              }, 100);
            } else {
              requestIdleCallback(() => this.render());
            }
          }
        },
        sanitizeClonedItem(item, cloneIndex) {
          if (item.getAttribute('is-clone')){
            const allElements = item.querySelectorAll('[id], [for], [form]');
            allElements.forEach(el => {
              if (el.hasAttribute('id')) {
                const newId = `${el.getAttribute('id')}-clone-${cloneIndex}`;
                el.setAttribute('id', newId);
              }
              if (el.hasAttribute('for')) {
                const newFor = `${el.getAttribute('for')}-clone-${cloneIndex}`;
                el.setAttribute('for', newFor);
              }
              if (el.hasAttribute('form')) {
                const newForm = `${el.getAttribute('form')}-clone-${cloneIndex}`;
                el.setAttribute('form', newForm);
              }
            });
          }
          
        },
        getIndex(i) {
          return (i + this.slideList.length) % this.slideList.length;
        },
        pauseVideo() {
          if (autoplay){
            if (window.innerWidth > 767) {
              const activeItem = this.slideList[this.getIndex(this.activeIndex)];
              let activeVideo;
              let activeExternal;
              if (window.innerWidth > 767){
                activeVideo = activeItem.querySelector('video');
                activeExternal= activeItem.querySelector('.yt-vimec-video');
              } else {
                activeVideo = activeItem.querySelector('.mobile-video-container video');
                activeExternal= activeItem.querySelector('.mobile-video-container .yt-vimec-video');
              }
              
              if (activeVideo) {
                activeVideo.pause();
              }
              if (activeExternal) {
                Alpine.store('xVideo').pause(activeExternal)
              }   
            } else {
              if (swipeOnMobile) {
                const activeItem = this.slideList[this.getIndex(this.activeIndex)];
                let activeVideo;
                let activeExternal;
                if (window.innerWidth > 767){
                  activeVideo = activeItem.querySelector('video');
                  activeExternal= activeItem.querySelector('.yt-vimec-video');
                } else {
                  activeVideo = activeItem.querySelector('.mobile-video-container video');
                  activeExternal= activeItem.querySelector('.mobile-video-container .yt-vimec-video');
                }
                
                if (activeVideo) {
                  activeVideo.pause();
                }
                if (activeExternal) {
                  Alpine.store('xVideo').pause(activeExternal)
                }   
              }
            }  
          }
        },
        continueVideo() {
          if (autoplay){
            if (window.innerWidth > 767) {
              const activeItem = this.slideList[this.getIndex(this.activeIndex)];
              let activeVideo;
              let activeExternal;
              if (window.innerWidth > 767){
                activeVideo = activeItem.querySelector('video');
                activeExternal= activeItem.querySelector('.yt-vimec-video');
              } else {
                activeVideo = activeItem.querySelector('.mobile-video-container video');
                activeExternal= activeItem.querySelector('.mobile-video-container .yt-vimec-video');
              }

              if (activeVideo) {
                activeVideo.play();
              }
              if (activeExternal) {
                Alpine.store('xVideo').play(activeExternal)
              }          
            } else {
              if (swipeOnMobile) {
                const activeItem = this.slideList[this.getIndex(this.activeIndex)];
                let activeVideo;
                let activeExternal;
                if (window.innerWidth > 767){
                  activeVideo = activeItem.querySelector('video');
                  activeExternal= activeItem.querySelector('.yt-vimec-video');
                } else {
                  activeVideo = activeItem.querySelector('.mobile-video-container video');
                  activeExternal= activeItem.querySelector('.mobile-video-container .yt-vimec-video');
                }
                if (activeVideo) {
                  activeVideo.play();
                }
                if (activeExternal) {
                  Alpine.store('xVideo').play(activeExternal)
                }          
              }
            }
          }
        },
        playActiveVideo() {
          const activeItem = this.slideList[this.getIndex(this.activeIndex)];
          let activeVideo;
          let activeExternal;
          if (window.innerWidth > 767){
            activeVideo = activeItem.querySelector('video');
            activeExternal= activeItem.querySelector('.yt-vimec-video');
            let activeDesktopContainer = activeItem.querySelector('.desktop-video-container');
            activeDesktopContainer.querySelector('.img-thumbnail')?.classList.add('hidden');
          } else {
            activeVideo = activeItem.querySelector('.mobile-video-container video');
            activeExternal= activeItem.querySelector('.mobile-video-container .yt-vimec-video');
            activeMobileContainer = activeItem.querySelector('.mobile-video-container');
            activeMobileContainer.querySelector('.img-thumbnail')?.classList.add('hidden');
          }

          this.slideList.forEach(item => {
            const video = item.querySelector('video');
            const externalVideo = item.querySelector('.iframe-video');
            const externalContainer = item.querySelector('.yt-vimec-video');
            if (video) {
              video.pause();
              if (window.innerWidth > 767) {
                const videoContainer = video.closest('.desktop-video-container');
                const buttonPlay = videoContainer.querySelector('.button-play');
                buttonPlay.classList.add('hidden')
              }
            } else 
            if (externalVideo && externalContainer) {
              Alpine.store('xVideo').pause(externalContainer)
              externalVideo.contentWindow.postMessage(JSON.stringify({
                method: 'pause'
              }), '*');
            }

            const videoMobile = item.querySelector('.mobile-video-container video');
            const externalVideoMobile = item.querySelector('.mobile-video-container .iframe-video');
            const externalContainerMobile = item.querySelector('.mobile-video-container .yt-vimec-video');
            if (videoMobile) {
              videoMobile.pause();
              if (window.innerWidth < 767) {
                const videoContainer = videoMobile.closest('.mobile-video-container');
                const buttonPlay = videoContainer.querySelector('.button-play');
                buttonPlay.classList.add('hidden')
              }
            } else 
            if (externalVideoMobile && externalContainerMobile) {
              Alpine.store('xVideo').pause(externalContainerMobile)
              externalVideoMobile.contentWindow.postMessage(JSON.stringify({
                method: 'pause'
              }), '*');
            }
          });                
        
          document.querySelectorAll(`#pagination-${sectionId} .pagination-dot .progress`).forEach(progress => {
            progress.style.animation = 'none';
            progress.style.width = '0%';
          });

          const animateProgressJS = (video, progressBar) => {
            if (!video || !progressBar) return;
            
            let rafId;

            const updateProgress = () => {
              if (video.duration > 0) {
                const percent = (video.currentTime / video.duration) * 100;
                progressBar.style.width = percent + "%";
              }
              rafId = requestAnimationFrame(updateProgress);
            };

            video.addEventListener("play", () => {
              cancelAnimationFrame(rafId);
              updateProgress();
            });

            video.addEventListener("pause", () => {
              cancelAnimationFrame(rafId);
            });

            video.addEventListener("ended", () => {
              cancelAnimationFrame(rafId);
              progressBar.style.width = "100%";
            });
          };


          if (activeExternal) {
            const videoType = activeExternal.getAttribute("video-type");
            const videoId = activeExternal.getAttribute("video-id");
            const videoAlt = activeExternal.getAttribute("video-alt");
            const isVideoLoaded = activeExternal.getAttribute("video-loaded")

            if (isVideoLoaded == 'false') {
              Alpine.store('xVideo').externalLoad(activeExternal, videoType, videoId, false, videoAlt, 1);
              activeExternal.setAttribute("video-loaded", "true")
            } else {
              const activeIframe = activeExternal.querySelector('iframe');
              if (videoType == "vimeo") {
                activeIframe.contentWindow.postMessage(JSON.stringify({
                  "method": "play",
                  "value": "true"
                }), '*');
              } else {                
                activeIframe.contentWindow.postMessage(JSON.stringify({
                  "event": "command",
                  "func": "playVideo"
                }), '*');
              }                            
            }
            
            if (!this._externalListener) {
              this._externalListener = {};
            }

            if (this._externalListener[sectionId]) {
              window.removeEventListener('message', this._externalListener[sectionId]);
            }

            let videoDuration;
            let rafId;
            const activeProgressDot = document.querySelector(`#pagination-${sectionId} .pagination-dot.active .progress`);
            const updateProgress = (current, duration) => {
              if (current !== undefined && duration > 0) {
                const percent = (current / duration) * 100;
                activeProgressDot.style.width = percent + "%";
              }
              rafId = requestAnimationFrame(updateProgress);
            };
            this._externalListener[sectionId] = (event) => {
              const activeIframe = activeExternal.querySelector('iframe');
              if (event.source !== activeIframe.contentWindow) return;
              if (event.origin === 'https://www.youtube.com') {
                try {
                  const data = JSON.parse(event.data);
                  if (data.info.duration && data.info.playerState == 1) {
                    videoDuration = data.info.duration;
                  }
                  if (videoDuration && activeProgressDot) {                    
                    if (data.event === 'onStateChange' && data.info === 1) {
                      cancelAnimationFrame(rafId);
                    } 
                    if (data.event === 'onStateChange' && data.info === 2) {
                      cancelAnimationFrame(rafId);
                    } else {
                      cancelAnimationFrame(rafId);
                      updateProgress(data.info.currentTime, videoDuration);
                    }
                  }
                  if (data.event === 'onStateChange' && data.info === 0) {
                    if (activeProgressDot) {
                      cancelAnimationFrame(rafId);
                      activeProgressDot.style.width = "100%";
                    }                    
                    activeIframe.contentWindow.postMessage(JSON.stringify({
                      "event": "command",
                      "func": "seekTo",
                      "args": [0, true]
                    }), '*');
                    this.activeIndex = this.getIndex(this.activeIndex + 1);
                    this.render();
                  }
                } catch (e) {}
              } else if (event.origin === 'https://player.vimeo.com') {
                try {
                  const data = JSON.parse(event.data);
                  if (data.event === 'play') {               
                    videoDuration = data.data.duration        
                  } 
                  if (data.event === 'playProgress') {               
                    cancelAnimationFrame(rafId);
                    updateProgress(data.data.seconds, videoDuration)        
                  }   
                  if (data.event === 'pause') {               
                    cancelAnimationFrame(rafId);    
                  }   
                  if (data.event === 'finish') {
                    if (activeProgressDot) {
                      cancelAnimationFrame(rafId); 
                      activeProgressDot.style.width = "100%";
                    }     
                    this.activeIndex = this.getIndex(this.activeIndex + 1);
                    this.render();
                  }                 
                } catch (e) {
                }
              } else {
                return
              };
            };

            window.addEventListener('message', this._externalListener[sectionId]);
          }
          
          if (activeVideo) {
            const activeProgressDot = document.querySelector(`#pagination-${sectionId} .pagination-dot.active .progress`);
            animateProgressJS(activeVideo, activeProgressDot);

            activeVideo.onended = () => {
              this.activeIndex = this.getIndex(this.activeIndex + 1);
              this.render();
            };
            requestAnimationFrame(() => {
              activeVideo.play().catch(() => {});
            });
          }
        },
        renderPagination() {
          if (showPagination){
            const paginationContainer = document.getElementById(`pagination-${sectionId}`);
            paginationContainer.innerHTML = '';
            for (let i = 0; i < this.originalCountItem; i++) {
              const dot = document.createElement('div');
              dot.className = 'pagination-dot';
              if (i === this.activeIndex % this.originalCountItem) {         
                const activeItem = this.slideList[this.getIndex(this.activeIndex)];
                let activeVideo;
                let activeExternal;
                if (activeItem) {
                  if (window.innerWidth > 767){
                    activeVideo = activeItem.querySelector('video');
                    activeExternal= activeItem.querySelector('.yt-vimec-video');
                  } else {
                    activeVideo = activeItem.querySelector('.mobile-video-container video');
                    activeExternal= activeItem.querySelector('.mobile-video-container .yt-vimec-video');
                  }  
                }      
                if (activeVideo && autoplay || activeExternal && autoplay){
                  dot.classList.add('autoplay');
                }
                dot.classList.add('active');
              }
              const progress = document.createElement('div');
              progress.className = 'progress';
              dot.appendChild(progress);
          
              dot.addEventListener('click', () => {
                this.activeIndex = i;
                this.render();  
              });
              paginationContainer.appendChild(dot);
            }
          }
        },
        render() {
          let center = 0;
          if (window.innerWidth > 767) {
            center = Math.floor(7 / 2);
          } else {
            center = Math.floor(this.slideList.length / 2);
          }
          requestAnimationFrame(() => {
            for (let i = 0; i < this.slideList.length; i++) {
              this.slideList[i].style.opacity = '0';
              this.slideList[i].style.zIndex = '0';
              this.slideList[i].style.transform = 'translateX(0)';
              this.slideList[i].style.margin = '0';
              this.slideList[i].style.transition = 'all 0.4s ease';
              this.slideList[i].classList.remove('active-slide');
            }
          
            for (let i = -center; i <= center; i++) {
              let idx = this.getIndex(this.activeIndex + i);
              const item = this.slideList[idx];
              const absPos = Math.abs(i);
              const height = this.originalHeight - absPos * 70;
              let opacity = 0;
              if (window.innerWidth > 767) {
                opacity = absPos > 2 ? 0 : 1;
              }
              const shift = i * 100;
              const marginLeft = i * spacing;
          
              item.style.zIndex = 10 - absPos;
              item.style.opacity = opacity;
              if (applyBlackWhiteEffect) {
                item.style.filter = 'grayscale(1)';
              }
              item.style.transform = `translateX(${shift}%)`;
              item.style.height = `${height}px`;
              item.style.marginTop = `${(this.originalHeight - height) / 2}px`;
              item.style.marginLeft = `${marginLeft}px`;
            }
            this.slideList[this.activeIndex].classList.add('active-slide');
            this.slideList[this.activeIndex].style.pointerEvents = 'auto';
            this.slideList[this.activeIndex].style.filter = 'grayscale(0)'
            if (window.innerWidth < 767) {
              this.slideList[this.activeIndex].style.opacity = '1'
            }
          })
          this.renderPagination();
          if (autoplay){
            this.playActiveVideo();
            if (window.innerWidth > 767) {
              document.addEventListener('visibilitychange', () => {
                if (!document.hidden) {
                  const slideInCard = this.slideList[this.activeIndex].querySelector('.slide-animation');
                  if (slideInCard) {
                    if (slideInCard.classList.contains('translate-y-0') == false){
                      this.playActiveVideo();
                    }      
                  } else {
                    this.playActiveVideo();
                  }
                }
              }); 
            }           
          } else {
            this.slideList.forEach(item => {
              const video = item.querySelector('video');
              const externalVideo = item.querySelector('.iframe-video');
              const externalContainer = item.querySelector('.yt-vimec-video');
              if (video) {
                video.pause();
                video.closest('.external-video').querySelector('.button-play').classList.remove('hidden');
              } else if (externalVideo && externalContainer) {
                Alpine.store('xVideo').pause(externalContainer);
                externalVideo.contentWindow.postMessage(JSON.stringify({
                  method: 'pause'
                }), '*');
              }

              const videoMobile = item.querySelector('.mobile-video-container video');
              const externalVideoMobile = item.querySelector('.mobile-video-container .iframe-video');
              const externalContainerMobile = item.querySelector('.mobile-video-container .yt-vimec-video');
              if (videoMobile) {
                videoMobile.pause();
                videoMobile.closest('.external-video').querySelector('.button-play').classList.remove('hidden');
              } else if (externalVideoMobile && externalContainerMobile) {
                Alpine.store('xVideo').pause(externalContainerMobile)
                externalVideoMobile.contentWindow.postMessage(JSON.stringify({
                  method: 'pause'
                }), '*');
              }
            });
          }
        },
        goToSlide(el) {
          const slideIndex = el.closest('.item').getAttribute('slide-index');
          if (slideIndex) {
            const slideOffset = slideIndex - this.activeIndex;
            this.activeIndex = this.getIndex(this.activeIndex + slideOffset);
            this.render();
          }
        },
        nextSlide() {
          if (this.originalCountItem > 1) {
            this.activeIndex = this.getIndex(this.activeIndex + 1);
            this.render();
          }
        },
        prevSlide() {
          if (this.originalCountItem > 1) {
            this.activeIndex = this.getIndex(this.activeIndex - 1);
            this.render();
          }
        },
        onMouseDown(e) {
          this.startSwipePosition = e.clientX;
          this.isSwiping = true
        },
        onMouseMove(e) {
          if (!this.isSwiping) return;
          const diffX = e.clientX - this.startSwipePosition;
          if (Math.abs(diffX) > 50) {
            this.isSwiping = false;
            if (diffX < 0) {
              this.nextSlide()
            } else {
              this.prevSlide()
            }
          }
        },
        onMouseUp() {
          this.isSwiping = false
        },
        onMouseLeave() {
          this.isSwiping = false
        },
        onTouchStart(e) {
          this.startSwipePosition = e.touches[0].clientX;
          this.isSwiping = true;
        },
        onTouchMove(e) {
          if (!this.isSwiping) return;
          const diffX = e.touches[0].clientX - this.startSwipePosition;
          if (Math.abs(diffX) > 50) {
            this.isSwiping = false;
            if (diffX < 0) {
              this.nextSlide()
            } else {
              this.prevSlide()
            }
          }
        },
        onTouchEnd() {
          this.isSwiping = false
        },
        onTouchCancel() {
          this.isSwiping = false
        }
      }))
    })
  })
}