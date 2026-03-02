if (!window.Eurus.loadedScript.has('highlight-text-with-image.js')) {
    window.Eurus.loadedScript.add('highlight-text-with-image.js');
    
    requestAnimationFrame(() => {
      document.addEventListener('alpine:init', () => {
        Alpine.data('xHighlightAnimation', () => ({
          initElements: null,
          animationFrameId: null,
          window_height: window.innerHeight,

          load(el, rtl_check, equalLines, fullScreen = false, range) {
            this.initElements = this.separateWords(el);
            this.partitionIntoLines(el, rtl_check, equalLines, fullScreen, range);

            let lastWidth = window.innerWidth;
            window.addEventListener("resize", this.debounce(() => {
              if (window.innerWidth !== lastWidth) {
                lastWidth = window.innerWidth;
                this.partitionIntoLines(el, rtl_check, equalLines, fullScreen, range);
              }
            }));
          },

          debounce(func, timeout = 300){
            let timer;
            return (...args) => {
              clearTimeout(timer);
              timer = setTimeout(() => { func.apply(this, args); }, timeout);
            };
          },

          calRelativePos(el, rtl_check = false) {
            const elRect = el.getBoundingClientRect();
            const parentRect = el.parentElement.getBoundingClientRect();

            const pos = Math.round((elRect.left - parentRect.left) / parentRect.width * 100)
            
            return rtl_check ? Math.max(0, Math.min(100, 100 - pos)) : pos;
          },

          separateWords(container) {
            let elements = [];
          
            container.childNodes.forEach(node => {
              if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '') {
                let words = node.textContent.match(/(\s+|[^\s-]+|[-])/g);
                words.forEach(word => {
                  if (word) {
                    let span = document.createElement("span");
                    span.textContent = word;
                    elements.push(span);  
                  }
                });
              } else if (node.nodeType === Node.ELEMENT_NODE) {
                elements.push(node);
              }
            });

            return elements;
          },

          partitionIntoLines(container, rtl_check, equalLines, fullScreen = false, range) {
            container.innerHTML = "";
            this.initElements.forEach(el => container.appendChild(el));
            let maxHeight = 0;
          
            requestAnimationFrame(() => {
              let lines = [];
              let currentLine = [];
              let prevMid = null;
          
              this.initElements.forEach((el) => {
                let rect = el.getBoundingClientRect();
                if (rect.width === 0) return;

                if (maxHeight < rect.height) {
                  maxHeight = rect.height;
                }
                let midpoint = rect.bottom + (rect.top - rect.bottom) / 2;
    
                if (prevMid !== null && Math.abs(midpoint - prevMid) > 10) {
                  lines.push(currentLine);
                  currentLine = [];
                } 
                currentLine.push(el);
                prevMid = midpoint;
              });
  
              if (currentLine.length) {
                lines.push(currentLine);
              }

              let newInnerHTML = lines.map((lineElements) => {
                let div = document.createElement("div");
                if (equalLines) {
                  div.className = "text-highlight content-center relative inline-block text-[rgba(var(--colors-heading),0.3)]";
                  div.style.height = `${maxHeight + 8}px`;
                } else {
                  div.className = "text-highlight content-center relative inline-block text-[rgba(var(--colors-heading),0.3)] mb-0.5";
                }
                lineElements.forEach(el => div.appendChild(el.cloneNode(true)));
                return div.outerHTML;
              }).join("");
            
              container.innerHTML = newInnerHTML;  
              container.setAttribute("x-intersect.once.margin.300px", "startAnim($el, " + rtl_check + ", " + fullScreen + ", " + range + ")");
            });
          },

          startAnim(el, rtl_check, fullScreen = false, range) {
            let starts = [];
            let ends = [];

            if (fullScreen) {
              let offsetStart = el.offsetParent.parentElement.getBoundingClientRect().top + window.scrollY;

              const offsets = { 3000: -200, 2000: 200 };
              let offset = offsets[range] ?? 600;
              
              el.childNodes.forEach((element, index) => {
                if (index != 0) {
                  starts.push(ends[index - 1]);
                  ends.push(starts[index] + range);
                } else {
                  starts.push(offsetStart);
                  ends.push(offsetStart + range)
                }
              });
              el.offsetParent.parentElement.style.height = `calc(${ends[ends.length - 1] - starts[0] + range / 2 + offset}px)`
            } else {
              starts = [0.7];
              ends = [0.5];
              
              el.childNodes.forEach((element, index) => {
                if (index != el.childNodes.length - 1) {
                  const element_rect = element.getBoundingClientRect();
                  const element_height = Math.abs(element_rect.bottom - element_rect.top) / this.window_height;
                  let start = ends[index] + element_height;
                  starts.push(start);
                  ends.push(Math.max(start - 0.2, 0.2));
                }
              });
            }
            this.createObserver(el, rtl_check, starts, ends, fullScreen);
          },

          createObserver(el, rtl_check, starts, ends, fullScreen = false) {
            const option = {
              root: null,
              rootMargin: '300px',
              threshold: 0
            };

            const observer = new IntersectionObserver((entries) => {
              entries.forEach((entry) => {
                if (entry.isIntersecting) {
                  this.updateHighlight(el, rtl_check, starts, ends, fullScreen);
                } else {
                  if (this.animationFrameId) {
                    cancelAnimationFrame(this.animationFrameId);
                    this.animationFrameId = null;
                  }
                }
              });
            }, option);

            observer.observe(el);
          },
          
          updateHighlight(el, rtl_check = false, starts, ends, fullScreen = false) {
            const update = () => {
              el.childNodes.forEach((element, index) => {
                let value;
                const element_rect = element.getBoundingClientRect();
                let position = fullScreen ? window.scrollY : Math.max(Math.min((element_rect.top / this.window_height), 1), 0);

                if (fullScreen) {
                  if (position < starts[index]) {
                    value = 0;
                  } else if (position > ends[index]) {
                    value = 120;
                  } else {
                    value = 120 * (position - starts[index]) / (ends[index] - starts[index]);
                  }
                } else {
                  if (position > starts[index]) {
                    value = 0;
                  } else if (position < ends[index]) {
                    value = 120;
                  } else {
                    value = 120 * (position - starts[index]) / (ends[index] - starts[index]);
                  }
                }
    
                element.style.backgroundSize = `${value}%`;
                Array.from(element.getElementsByClassName('highlight')).forEach(el => {
                  if (Math.round(value) > this.calRelativePos(el, rtl_check)) {
                    el.classList.add('highlight-anm-start');
                    el.classList.remove('highlight-anm-end');
                  } else {
                    el.classList.remove('highlight-anm-start');
                    el.classList.add('highlight-anm-end');
                  }
                });
                element.style.setProperty('--highlight-fill-stop', `${element.offsetWidth * value / 100 - element.offsetWidth * 0.2}px`);
                element.style.setProperty('--highlight-unfill-stop', `${element.offsetWidth * value / 100}px`)
              });
              
              this.animationFrameId = window.requestAnimationFrame(update);
            }

            if (!this.animationFrameId) {
              update();
            }
          }
        }));
      })
    });
  }